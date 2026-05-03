import { getGroqClient } from "./client";
import { DEFAULT_VISION_MODEL, assertChatModel, estimateChatCostUsd } from "./models";
import { assertWithinBudget, BudgetExceededError } from "./quota";
import { hashPrompt, logAiRun } from "./runs";
import type { ChatResult, VisionImage, VisionOptions } from "./types";

function imageToContentPart(img: VisionImage): { type: "image_url"; image_url: { url: string } } {
  if (img.url) return { type: "image_url", image_url: { url: img.url } };
  if (img.base64) {
    const mime = img.mimeType ?? "image/jpeg";
    return { type: "image_url", image_url: { url: `data:${mime};base64,${img.base64}` } };
  }
  throw new Error("Vision image requires either url or base64");
}

export async function vision<T = string>(opts: VisionOptions<T>): Promise<ChatResult<T>> {
  const model = opts.model ?? DEFAULT_VISION_MODEL;
  assertChatModel(model);
  const promptHash = hashPrompt(opts.prompt);
  const startedAt = Date.now();

  try {
    await assertWithinBudget(opts.ctx.tenantId);
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      await logAiRun({
        ctx: opts.ctx, model, promptHash,
        latencyMs: Date.now() - startedAt, costUsd: 0,
        status: "over_budget", errorMessage: err.message,
        metadata: opts.metadata ?? null,
      });
    }
    throw err;
  }

  const client = getGroqClient();
  try {
    const userContent = [
      { type: "text" as const, text: opts.prompt },
      ...opts.images.map(imageToContentPart),
    ];

    const completion = await client.chat.completions.create({
      model,
      messages: [
        // groq-sdk types userContent as a tagged union; cast to satisfy TS without changing payload shape.
        { role: "user", content: userContent as unknown as string },
      ],
      max_tokens: opts.maxTokens ?? 2048,
      response_format: opts.jsonSchema ? { type: "json_object" } : undefined,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;
    const totalTokens = completion.usage?.total_tokens ?? promptTokens + completionTokens;
    const latencyMs = Date.now() - startedAt;
    const costUsd = estimateChatCostUsd(model, promptTokens, completionTokens);

    let content: T;
    if (opts.jsonSchema) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`Vision AI returned invalid JSON for feature "${opts.ctx.feature}"`);
      }
      content = opts.jsonSchema.parse(parsed) as T;
    } else {
      content = raw as unknown as T;
    }

    await logAiRun({
      ctx: opts.ctx, model, promptHash,
      promptTokens, completionTokens, totalTokens,
      latencyMs, costUsd, status: "ok",
      metadata: opts.metadata ?? null,
    });

    return { content, raw, model, promptTokens, completionTokens, totalTokens, latencyMs, costUsd };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logAiRun({
      ctx: opts.ctx, model, promptHash,
      latencyMs: Date.now() - startedAt, costUsd: 0,
      status: "error", errorMessage: message,
      metadata: opts.metadata ?? null,
    });
    throw err;
  }
}
