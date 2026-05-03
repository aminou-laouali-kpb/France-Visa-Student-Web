// Groq pricing (USD per 1M tokens for chat, USD per audio-hour for whisper).
// Update as Groq's pricing changes; values used only for cost estimation.
export interface ChatPricing {
  kind: "chat";
  inputPer1M: number;
  outputPer1M: number;
}

export interface AudioPricing {
  kind: "audio";
  perAudioHour: number;
}

export type ModelPricing = ChatPricing | AudioPricing;

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "llama-3.3-70b-versatile": { kind: "chat", inputPer1M: 0.59, outputPer1M: 0.79 },
  "llama-3.1-8b-instant": { kind: "chat", inputPer1M: 0.05, outputPer1M: 0.08 },
  "meta-llama/llama-4-scout-17b-16e-instruct": { kind: "chat", inputPer1M: 0.11, outputPer1M: 0.34 },
  "meta-llama/llama-4-maverick-17b-128e-instruct": { kind: "chat", inputPer1M: 0.2, outputPer1M: 0.6 },
  "whisper-large-v3": { kind: "audio", perAudioHour: 0.111 },
  "whisper-large-v3-turbo": { kind: "audio", perAudioHour: 0.04 },
};

export const DEFAULT_CHAT_MODEL = "llama-3.3-70b-versatile";
export const DEFAULT_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
export const DEFAULT_TRANSCRIBE_MODEL = "whisper-large-v3-turbo";

export class UnknownModelError extends Error {
  constructor(model: string, expected: "chat" | "audio") {
    super(
      `Unknown or unpriced ${expected} model "${model}". Add it to MODEL_PRICING in @workspace/ai/models.`,
    );
    this.name = "UnknownModelError";
  }
}

export function assertChatModel(model: string): ChatPricing {
  const p = MODEL_PRICING[model];
  if (!p || p.kind !== "chat") throw new UnknownModelError(model, "chat");
  return p;
}

export function assertAudioModel(model: string): AudioPricing {
  const p = MODEL_PRICING[model];
  if (!p || p.kind !== "audio") throw new UnknownModelError(model, "audio");
  return p;
}

export function estimateChatCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = assertChatModel(model);
  return (
    (promptTokens * p.inputPer1M) / 1_000_000 +
    (completionTokens * p.outputPer1M) / 1_000_000
  );
}

export function estimateAudioCostUsd(model: string, audioSeconds: number): number {
  const p = assertAudioModel(model);
  return (audioSeconds / 3600) * p.perAudioHour;
}
