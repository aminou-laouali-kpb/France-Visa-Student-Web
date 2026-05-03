import type { z } from "zod";

export interface AiContext {
  feature: string;
  userId?: number | null;
  studentId?: number | null;
  tenantId?: number | null;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions<T = unknown> {
  ctx: AiContext;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonSchema?: z.ZodType<T>;
  metadata?: Record<string, unknown>;
}

export interface ChatResult<T = string> {
  content: T;
  raw: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsd: number;
}

export interface VisionImage {
  url?: string;
  base64?: string;
  mimeType?: string;
}

export interface VisionOptions<T = unknown> {
  ctx: AiContext;
  prompt: string;
  images: VisionImage[];
  model?: string;
  jsonSchema?: z.ZodType<T>;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
}

export interface TranscribeOptions {
  ctx: AiContext;
  audio: Buffer;
  filename?: string;
  language?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface TranscribeResult {
  text: string;
  durationSeconds: number;
  model: string;
  costUsd: number;
  latencyMs: number;
}
