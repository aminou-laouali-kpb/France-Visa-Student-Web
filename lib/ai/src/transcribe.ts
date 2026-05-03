import { getGroqClient } from "./client";
import { DEFAULT_TRANSCRIBE_MODEL, assertAudioModel, estimateAudioCostUsd } from "./models";
import { assertWithinBudget, BudgetExceededError } from "./quota";
import { logAiRun } from "./runs";
import type { TranscribeOptions, TranscribeResult } from "./types";

export async function transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
  const model = opts.model ?? DEFAULT_TRANSCRIBE_MODEL;
  assertAudioModel(model);
  const startedAt = Date.now();

  try {
    await assertWithinBudget(opts.ctx.tenantId);
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      await logAiRun({
        ctx: opts.ctx, model,
        latencyMs: Date.now() - startedAt, costUsd: 0,
        status: "over_budget", errorMessage: err.message,
        metadata: opts.metadata ?? null,
      });
    }
    throw err;
  }

  const client = getGroqClient();
  try {
    const filename = opts.filename ?? "audio.webm";
    const file = new File([new Uint8Array(opts.audio)], filename);
    const result = await client.audio.transcriptions.create({
      model,
      file,
      language: opts.language,
      response_format: "verbose_json",
    });

    const text = (result as { text?: string }).text ?? "";
    const durationSeconds = (result as { duration?: number }).duration ?? 0;
    const latencyMs = Date.now() - startedAt;
    const costUsd = estimateAudioCostUsd(model, durationSeconds);

    await logAiRun({
      ctx: opts.ctx, model,
      audioSeconds: durationSeconds,
      latencyMs, costUsd, status: "ok",
      metadata: opts.metadata ?? null,
    });

    return { text, durationSeconds, model, costUsd, latencyMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logAiRun({
      ctx: opts.ctx, model,
      latencyMs: Date.now() - startedAt, costUsd: 0,
      status: "error", errorMessage: message,
      metadata: opts.metadata ?? null,
    });
    throw err;
  }
}
