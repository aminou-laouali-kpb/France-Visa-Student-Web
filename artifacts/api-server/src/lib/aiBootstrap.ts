import { setTenantBudgetResolver } from "@workspace/ai";
import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const PLAN_TIER_BUDGETS_USD: Record<string, number> = {
  free: 5,
  pro: 50,
  enterprise: 500,
};

export function registerTenantBudgetResolver(): void {
  setTenantBudgetResolver(async (tenantId) => {
    try {
      const rows = await db
        .select({
          aiMonthlyBudgetUsd: tenantsTable.aiMonthlyBudgetUsd,
          planTier: tenantsTable.planTier,
        })
        .from(tenantsTable)
        .where(eq(tenantsTable.id, tenantId))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      if (row.aiMonthlyBudgetUsd != null) {
        const n = Number(row.aiMonthlyBudgetUsd);
        if (Number.isFinite(n) && n >= 0) return n;
      }
      const planBudget = PLAN_TIER_BUDGETS_USD[row.planTier];
      if (planBudget != null) return planBudget;
      return null;
    } catch (err) {
      logger.warn({ err, tenantId }, "tenant budget lookup failed");
      return null;
    }
  });
}
