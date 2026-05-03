import { getGroqClient, isGroqConfigured } from "./client";
import { DEFAULT_CHAT_MODEL } from "./models";
import { getMonthSpendUsd, getMonthlyBudgetUsd } from "./quota";

export interface AiHealthReport {
  configured: boolean;
  reachable: boolean;
  model: string;
  monthlyBudgetUsd: number;
  monthSpentUsd: number;
  error: string | null;
}

export async function checkAiHealth(tenantId?: number | null): Promise<AiHealthReport> {
  const configured = isGroqConfigured();
  const monthlyBudgetUsd = await getMonthlyBudgetUsd(tenantId);
  let monthSpentUsd = 0;
  try {
    monthSpentUsd = await getMonthSpendUsd(tenantId);
  } catch {
    monthSpentUsd = 0;
  }

  if (!configured) {
    return {
      configured: false,
      reachable: false,
      model: DEFAULT_CHAT_MODEL,
      monthlyBudgetUsd,
      monthSpentUsd,
      error: "GROQ_API_KEY is not set",
    };
  }

  try {
    const client = getGroqClient();
    await client.chat.completions.create({
      model: DEFAULT_CHAT_MODEL,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      temperature: 0,
    });
    return {
      configured: true,
      reachable: true,
      model: DEFAULT_CHAT_MODEL,
      monthlyBudgetUsd,
      monthSpentUsd,
      error: null,
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      model: DEFAULT_CHAT_MODEL,
      monthlyBudgetUsd,
      monthSpentUsd,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
