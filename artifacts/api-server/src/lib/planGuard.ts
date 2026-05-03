import type { Response } from "express";
import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export type PlanTier = "free" | "pro" | "enterprise";

const AI_FEATURE_ALLOWED_PLANS: PlanTier[] = ["pro", "enterprise"];

let cachedTenantId: number | null = null;

// NOTE: This codebase currently has no auth/tenant middleware — every request
// is implicitly served against the single default tenant. If/when per-request
// auth is introduced, replace `resolveDefaultTenantId()` with a function that
// reads the tenant from `req.user`/`req.auth` and remove the cache so plan
// gating is scoped per request rather than globally.
export async function resolveDefaultTenantId(): Promise<number | null> {
  if (cachedTenantId != null) return cachedTenantId;
  try {
    const [row] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .orderBy(tenantsTable.id)
      .limit(1);
    if (row) {
      cachedTenantId = row.id;
      return row.id;
    }
  } catch (err) {
    logger.warn({ err }, "default tenant lookup failed");
  }
  return null;
}

export async function getPlanTier(): Promise<PlanTier> {
  const tenantId = await resolveDefaultTenantId();
  if (!tenantId) return "free";
  try {
    const [row] = await db
      .select({ planTier: tenantsTable.planTier })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId))
      .limit(1);
    const tier = row?.planTier as PlanTier | undefined;
    return tier ?? "free";
  } catch (err) {
    logger.warn({ err }, "plan tier lookup failed");
    return "free";
  }
}

/**
 * Gates AI-powered features behind plan tier. Returns true when the request
 * may proceed; otherwise sends a 402 response and returns false.
 *
 * In dev / local environments where there is no tenant row yet, the default
 * tier is "free" so callers see a clear upgrade prompt rather than a hidden
 * AI bill.
 */
export async function requireAiPlan(
  res: Response,
  feature: string,
  allowed: PlanTier[] = AI_FEATURE_ALLOWED_PLANS,
): Promise<boolean> {
  const tier = await getPlanTier();
  if (allowed.includes(tier)) return true;
  res.status(402).json({
    error: "plan_required",
    message: `La fonctionnalité « ${feature} » nécessite une offre supérieure (actuelle: ${tier}).`,
    currentPlan: tier,
    requiredPlans: allowed,
  });
  return false;
}
