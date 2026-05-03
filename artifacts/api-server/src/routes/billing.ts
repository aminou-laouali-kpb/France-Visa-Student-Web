import { Router, type IRouter } from "express";
import express from "express";
import Stripe from "stripe";
import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, isAdmin } from "../middlewares/auth";
import { invalidateTenantCache, getTenant, PLAN_TIERS, type PlanTierKey } from "../lib/tenant";
import { logger } from "../lib/logger";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

// ─── Stripe client (lazy) ───────────────────────────────────────────────────
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function appBaseUrl(): string {
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}`;
  const prod = (process.env.REPLIT_DOMAINS ?? "").split(",")[0]?.trim();
  if (prod) return `https://${prod}`;
  return "http://localhost:5173";
}

// ─── GET /billing/plans — static catalog ────────────────────────────────────
router.get("/billing/plans", requireAuth, (_req, res) => {
  res.json({
    plans: [
      {
        tier: "free",
        name: "Free",
        priceEur: 0,
        priceId: null,
        seatLimit: PLAN_TIERS.free.seatLimit,
        studentLimit: PLAN_TIERS.free.studentLimit,
        aiBudgetUsd: PLAN_TIERS.free.aiMonthlyBudgetUsd,
        features: ["1 conseiller", "5 dossiers étudiants", "Pas d'IA générative"],
      },
      {
        tier: "pro",
        name: "Pro",
        priceEur: 49,
        priceId: process.env.STRIPE_PRICE_PRO ?? null,
        seatLimit: PLAN_TIERS.pro.seatLimit,
        studentLimit: PLAN_TIERS.pro.studentLimit,
        aiBudgetUsd: PLAN_TIERS.pro.aiMonthlyBudgetUsd,
        features: [
          "5 conseillers",
          "50 dossiers étudiants actifs",
          "20 USD/mois de crédit IA",
          "Support email prioritaire",
        ],
      },
      {
        tier: "agency",
        name: "Agency",
        priceEur: 199,
        priceId: process.env.STRIPE_PRICE_AGENCY ?? null,
        seatLimit: PLAN_TIERS.agency.seatLimit,
        studentLimit: PLAN_TIERS.agency.studentLimit,
        aiBudgetUsd: PLAN_TIERS.agency.aiMonthlyBudgetUsd,
        features: [
          "20 conseillers",
          "250 dossiers étudiants actifs",
          "80 USD/mois de crédit IA",
          "White-label complet",
          "SLA + support dédié",
        ],
      },
    ],
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
  });
});

// ─── POST /billing/checkout — open a Stripe Checkout session ───────────────
router.post("/billing/checkout", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  if (!isAdmin(user)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "stripe_not_configured" });
    return;
  }
  if (!user.tenantId) {
    res.status(400).json({ error: "no_tenant" });
    return;
  }
  const priceId = String((req.body as { priceId?: unknown })?.priceId ?? "").trim();
  if (!priceId) {
    res.status(400).json({ error: "missing_price_id" });
    return;
  }
  const tenant = await getTenant(user.tenantId);
  if (!tenant) {
    res.status(404).json({ error: "tenant_not_found" });
    return;
  }
  try {
    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: tenant.name,
        metadata: { tenantId: String(tenant.id) },
      });
      customerId = customer.id;
      await db
        .update(tenantsTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(tenantsTable.id, tenant.id));
      invalidateTenantCache(tenant.id);
    }
    const base = appBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/admin/billing?success=1`,
      cancel_url: `${base}/admin/billing?canceled=1`,
      subscription_data: {
        metadata: { tenantId: String(tenant.id) },
      },
      metadata: { tenantId: String(tenant.id) },
    });
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "stripe checkout failed");
    res.status(500).json({ error: "stripe_error" });
  }
});

// ─── POST /billing/portal — open the customer portal ───────────────────────
router.post("/billing/portal", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  if (!isAdmin(user)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "stripe_not_configured" });
    return;
  }
  const tenant = await getTenant(user.tenantId);
  if (!tenant?.stripeCustomerId) {
    res.status(400).json({ error: "no_customer" });
    return;
  }
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${appBaseUrl()}/admin/billing`,
    });
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "stripe portal failed");
    res.status(500).json({ error: "stripe_error" });
  }
});

// ─── Stripe Webhook — MUST be mounted with express.raw before express.json ──
// Exported separately and registered in app.ts so the raw body is preserved.
export const stripeWebhookHandler = [
  express.raw({ type: "application/json" }),
  async (req: express.Request, res: express.Response) => {
    const stripe = getStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !secret) {
      res.status(503).send("stripe_not_configured");
      return;
    }
    const sig = req.headers["stripe-signature"];
    if (typeof sig !== "string") {
      res.status(400).send("missing_signature");
      return;
    }
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
    } catch (err) {
      logger.warn({ err }, "stripe webhook signature failed");
      res.status(400).send("bad_signature");
      return;
    }

    const applySubscription = async (sub: Stripe.Subscription) => {
      const tenantIdRaw = sub.metadata?.tenantId;
      const tenantId = tenantIdRaw ? Number(tenantIdRaw) : null;
      if (!tenantId) {
        logger.warn({ subId: sub.id }, "stripe webhook: subscription without tenantId");
        return;
      }
      const item = sub.items.data[0];
      const price = item?.price;
      const planFromMeta = (price?.metadata?.plan_tier ?? sub.metadata?.plan_tier) as
        | string
        | undefined;
      const planTier: PlanTierKey =
        planFromMeta && planFromMeta in PLAN_TIERS
          ? (planFromMeta as PlanTierKey)
          : "pro";
      const limits = PLAN_TIERS[planTier];
      const periodEnd =
        typeof (sub as unknown as { current_period_end?: number }).current_period_end === "number"
          ? new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000)
          : null;
      await db
        .update(tenantsTable)
        .set({
          planTier,
          stripeSubscriptionId: sub.id,
          stripePriceId: price?.id ?? null,
          subscriptionStatus: sub.status,
          currentPeriodEnd: periodEnd,
          seatLimit: limits.seatLimit,
          studentLimit: limits.studentLimit,
          aiMonthlyBudgetUsd: limits.aiMonthlyBudgetUsd,
          updatedAt: new Date(),
        })
        .where(eq(tenantsTable.id, tenantId));
      invalidateTenantCache(tenantId);
      await logAudit({
        action: "billing.subscription_updated",
        entityType: "tenant",
        entityId: tenantId,
        details: `tier=${planTier} status=${sub.status}`,
      });
    };

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.subscription && typeof session.subscription === "string") {
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            // Re-stamp tenantId on the subscription if missing (checkout
            // metadata propagates only via subscription_data.metadata).
            if (!sub.metadata?.tenantId && session.metadata?.tenantId) {
              await stripe.subscriptions.update(sub.id, {
                metadata: { ...(sub.metadata ?? {}), tenantId: session.metadata.tenantId },
              });
              sub.metadata = { ...(sub.metadata ?? {}), tenantId: session.metadata.tenantId };
            }
            await applySubscription(sub);
          }
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.resumed":
          await applySubscription(event.data.object as Stripe.Subscription);
          break;
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const tenantId = sub.metadata?.tenantId ? Number(sub.metadata.tenantId) : null;
          if (tenantId) {
            await db
              .update(tenantsTable)
              .set({
                planTier: "free",
                subscriptionStatus: "canceled",
                stripeSubscriptionId: null,
                stripePriceId: null,
                seatLimit: PLAN_TIERS.free.seatLimit,
                studentLimit: PLAN_TIERS.free.studentLimit,
                aiMonthlyBudgetUsd: PLAN_TIERS.free.aiMonthlyBudgetUsd,
                updatedAt: new Date(),
              })
              .where(eq(tenantsTable.id, tenantId));
            invalidateTenantCache(tenantId);
          }
          break;
        }
        default:
          // Ignore other events.
          break;
      }
      res.json({ received: true });
    } catch (err) {
      logger.error({ err, type: event.type }, "stripe webhook handler failed");
      res.status(500).send("handler_error");
    }
  },
] as const;

export default router;
