import { getGroqClient } from "./client";
import { DEFAULT_CHAT_MODEL, assertChatModel, estimateChatCostUsd } from "./models";
import { assertWithinBudget, BudgetExceededError } from "./quota";
import { hashPrompt, logAiRun } from "./runs";
import type { ChatMessage, ChatOptions, ChatResult } from "./types";

function joinForHash(messages: ChatMessage[]): string {
  return messages.map((m) => `${m.role}:${m.content}`).join("\n");
}

export async function chat<T = string>(opts: ChatOptions<T>): Promise<ChatResult<T>> {
  const model = opts.model ?? DEFAULT_CHAT_MODEL;
  assertChatModel(model);
  const promptHash = hashPrompt(joinForHash(opts.messages));
  const startedAt = Date.now();

  try {
    await assertWithinBudget(opts.ctx.tenantId);
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      await logAiRun({
        ctx: opts.ctx,
        model,
        promptHash,
        latencyMs: Date.now() - startedAt,
        costUsd: 0,
        status: "over_budget",
        errorMessage: err.message,
        metadata: opts.metadata ?? null,
      });
    }
    throw err;
  }

  const client = getGroqClient();
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
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
        throw new Error(`AI returned invalid JSON for feature "${opts.ctx.feature}"`);
      }
      content = opts.jsonSchema.parse(parsed) as T;
    } else {
      content = raw as unknown as T;
    }

    await logAiRun({
      ctx: opts.ctx,
      model,
      promptHash,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      costUsd,
      status: "ok",
      metadata: opts.metadata ?? null,
    });

    return { content, raw, model, promptTokens, completionTokens, totalTokens, latencyMs, costUsd };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logAiRun({
      ctx: opts.ctx,
      model,
      promptHash,
      latencyMs: Date.now() - startedAt,
      costUsd: 0,
      status: "error",
      errorMessage: message,
      metadata: opts.metadata ?? null,
    });
    throw err;
  }
}

export interface ChatStreamChunk {
  delta: string;
}

export interface ChatStreamFinal {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsd: number;
  model: string;
}

export async function* chatStream(
  opts: ChatOptions<string>,
): AsyncGenerator<ChatStreamChunk, ChatStreamFinal, void> {
  const model = opts.model ?? DEFAULT_CHAT_MODEL;
  assertChatModel(model);
  const promptHash = hashPrompt(joinForHash(opts.messages));
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
  let accumulated = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 2048,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        accumulated += delta;
        yield { delta };
      }
      const usage = (chunk as { x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } } }).x_groq?.usage;
      if (usage) {
        promptTokens = usage.prompt_tokens ?? promptTokens;
        completionTokens = usage.completion_tokens ?? completionTokens;
        totalTokens = usage.total_tokens ?? totalTokens;
      }
    }

    const latencyMs = Date.now() - startedAt;
    const costUsd = estimateChatCostUsd(model, promptTokens, completionTokens);

    await logAiRun({
      ctx: opts.ctx, model, promptHash,
      promptTokens, completionTokens, totalTokens,
      latencyMs, costUsd, status: "ok",
      metadata: opts.metadata ?? null,
    });

    return { content: accumulated, promptTokens, completionTokens, totalTokens, latencyMs, costUsd, model };
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
