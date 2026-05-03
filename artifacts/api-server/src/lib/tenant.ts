import { db, tenantsTable, type Tenant } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const cache = new Map<number, Tenant>();

export async function getTenant(tenantId: number | null | undefined): Promise<Tenant | null> {
  if (!tenantId) return null;
  if (cache.has(tenantId)) return cache.get(tenantId)!;
  try {
    const [row] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId))
      .limit(1);
    if (row) {
      cache.set(tenantId, row);
      return row;
    }
  } catch (err) {
    logger.warn({ err, tenantId }, "tenant lookup failed");
  }
  return null;
}

export function invalidateTenantCache(tenantId?: number) {
  if (tenantId == null) cache.clear();
  else cache.delete(tenantId);
}

/**
 * Plan tier → resource limits & included AI budget. Mirrored on the tenant
 * row by the Stripe webhook so other code paths can read directly without
 * importing this map.
 */
export const PLAN_TIERS = {
  free: { seatLimit: 1, studentLimit: 5, aiMonthlyBudgetUsd: "0.00" },
  pro: { seatLimit: 5, studentLimit: 50, aiMonthlyBudgetUsd: "20.00" },
  agency: { seatLimit: 20, studentLimit: 250, aiMonthlyBudgetUsd: "80.00" },
  enterprise: { seatLimit: 100, studentLimit: 2000, aiMonthlyBudgetUsd: "400.00" },
} as const;

export type PlanTierKey = keyof typeof PLAN_TIERS;
