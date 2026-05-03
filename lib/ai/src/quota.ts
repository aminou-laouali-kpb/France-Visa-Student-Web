import { db, aiRunsTable } from "@workspace/db";
import { sql, and, gte, eq } from "drizzle-orm";

export class BudgetExceededError extends Error {
  constructor(public readonly spent: number, public readonly budget: number) {
    super(
      `AI monthly budget exceeded: $${spent.toFixed(2)} spent of $${budget.toFixed(2)} budget.`,
    );
    this.name = "BudgetExceededError";
  }
}

export function getMonthlyBudgetUsd(): number {
  const raw = process.env["AI_MONTHLY_BUDGET_USD"];
  if (!raw) return 50;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 50;
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function getMonthSpendUsd(tenantId?: number | null): Promise<number> {
  const start = startOfMonth();
  const whereClause = tenantId == null
    ? gte(aiRunsTable.createdAt, start)
    : and(gte(aiRunsTable.createdAt, start), eq(aiRunsTable.tenantId, tenantId));
  const rows = await db
    .select({ total: sql<string>`COALESCE(SUM(${aiRunsTable.costUsd}), 0)` })
    .from(aiRunsTable)
    .where(whereClause);
  const v = rows[0]?.total ?? "0";
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function assertWithinBudget(tenantId?: number | null): Promise<void> {
  const budget = getMonthlyBudgetUsd();
  if (budget <= 0) return;
  const spent = await getMonthSpendUsd(tenantId);
  if (spent >= budget) {
    throw new BudgetExceededError(spent, budget);
  }
}
