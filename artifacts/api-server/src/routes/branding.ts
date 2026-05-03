import { Router, type IRouter } from "express";
import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, isAdmin } from "../middlewares/auth";
import { invalidateTenantCache, getTenant } from "../lib/tenant";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

function publicBranding(t: NonNullable<Awaited<ReturnType<typeof getTenant>>>) {
  return {
    tenantId: t.id,
    name: t.name,
    subdomain: t.subdomain,
    logoUrl: t.logoUrl,
    primaryColor: t.primaryColor,
    emailFromName: t.emailFromName,
    emailFromAddress: t.emailFromAddress,
  };
}

// Public-ish: any signed-in user reads their tenant's branding (so the
// frontend can theme itself). Returns null when user has no tenant yet.
router.get("/tenant/branding", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  if (!user.tenantId) {
    res.json(null);
    return;
  }
  const t = await getTenant(user.tenantId);
  if (!t) {
    res.json(null);
    return;
  }
  res.json(publicBranding(t));
});

// Admin-only: full tenant settings (branding + plan/limits + billing snapshot
// + ip allowlist).
router.get("/tenant/settings", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  if (!isAdmin(user)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!user.tenantId) {
    res.status(404).json({ error: "no_tenant" });
    return;
  }
  const t = await getTenant(user.tenantId);
  if (!t) {
    res.status(404).json({ error: "no_tenant" });
    return;
  }
  res.json({
    ...publicBranding(t),
    planTier: t.planTier,
    seatLimit: t.seatLimit,
    studentLimit: t.studentLimit,
    aiMonthlyBudgetUsd: t.aiMonthlyBudgetUsd,
    ipAllowlist: t.ipAllowlist,
    twoFactorRequired: t.twoFactorRequired,
    subscriptionStatus: t.subscriptionStatus,
    currentPeriodEnd: t.currentPeriodEnd ? t.currentPeriodEnd.toISOString() : null,
    stripeCustomerId: t.stripeCustomerId,
  });
});

// Admin-only: update branding + ip allowlist + tenant name.
router.patch("/tenant/settings", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  if (!isAdmin(user)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!user.tenantId) {
    res.status(404).json({ error: "no_tenant" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of [
    "name",
    "subdomain",
    "logoUrl",
    "primaryColor",
    "emailFromName",
    "emailFromAddress",
    "ipAllowlist",
  ]) {
    if (k in body) {
      const v = body[k];
      patch[k === "logoUrl" ? "logoUrl" : k] =
        typeof v === "string" && v.trim().length === 0 ? null : v;
    }
  }
  if ("twoFactorRequired" in body) {
    patch.twoFactorRequired = !!body.twoFactorRequired;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "no_fields" });
    return;
  }
  patch.updatedAt = new Date();
  await db.update(tenantsTable).set(patch).where(eq(tenantsTable.id, user.tenantId));
  invalidateTenantCache(user.tenantId);
  await logAudit({
    userId: user.id,
    action: "tenant.settings_update",
    entityType: "tenant",
    entityId: user.tenantId,
    details: `keys=${Object.keys(patch).join(",")}`,
  });
  const updated = await getTenant(user.tenantId);
  res.json(updated ? publicBranding(updated) : null);
});

export default router;
