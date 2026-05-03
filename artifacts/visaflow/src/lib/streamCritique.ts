import type { CritiqueResult } from "@workspace/api-client-react";

export interface StreamCritiqueHandlers {
  onDelta?: (delta: string) => void;
  onResult?: (result: CritiqueResult) => void;
  onError?: (message: string) => void;
}

/**
 * POST to an SSE endpoint and forward parsed events to the handlers.
 * Falls back to throwing on transport errors so callers can show an alert.
 */
export async function streamCritique(
  url: string,
  handlers: StreamCritiqueHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "text/event-stream" },
    signal,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      detail = body.message ?? body.error ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
      }
      if (dataLines.length === 0) continue;
      const dataStr = dataLines.join("\n");
      let data: unknown;
      try {
        data = JSON.parse(dataStr);
      } catch {
        continue;
      }
      if (event === "delta") {
        const d = (data as { delta?: string }).delta ?? "";
        if (d) handlers.onDelta?.(d);
      } else if (event === "result") {
        handlers.onResult?.(data as CritiqueResult);
      } else if (event === "error") {
        const msg =
          (data as { message?: string }).message ?? "Erreur de streaming.";
        handlers.onError?.(msg);
      }
    }
  }
}
