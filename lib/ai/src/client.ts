import Groq from "groq-sdk";

let cached: Groq | null = null;

export function getGroqClient(): Groq {
  if (cached) return cached;
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. AI features are unavailable until the secret is configured.",
    );
  }
  cached = new Groq({ apiKey });
  return cached;
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env["GROQ_API_KEY"]);
}
