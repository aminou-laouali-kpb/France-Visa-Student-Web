import { createHash } from "node:crypto";
import { db, aiRunsTable, type InsertAiRun } from "@workspace/db";
import type { AiContext } from "./types";

export function hashPrompt(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

export interface LogRunInput {
  ctx: AiContext;
  model: string;
  promptHash?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  audioSeconds?: number | null;
  latencyMs: number;
  costUsd: number;
  status: "ok" | "error" | "over_budget";
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logAiRun(input: LogRunInput): Promise<void> {
  const row: InsertAiRun = {
    tenantId: input.ctx.tenantId ?? null,
    userId: input.ctx.userId ?? null,
    studentId: input.ctx.studentId ?? null,
    feature: input.ctx.feature,
    model: input.model,
    promptHash: input.promptHash ?? null,
    promptTokens: input.promptTokens ?? 0,
    completionTokens: input.completionTokens ?? 0,
    totalTokens: input.totalTokens ?? 0,
    audioSeconds: input.audioSeconds != null ? String(input.audioSeconds) : null,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    costUsd: input.costUsd.toFixed(6),
    status: input.status,
    errorMessage: input.errorMessage ?? null,
    metadata: (input.metadata ?? null) as InsertAiRun["metadata"],
  };
  try {
    await db.insert(aiRunsTable).values(row);
  } catch (err) {
    // Logging must never break the caller; surface to stderr only.
    // eslint-disable-next-line no-console
    console.error("[ai] failed to log ai_run", err);
  }
}
