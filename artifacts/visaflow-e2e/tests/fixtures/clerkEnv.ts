import { createClerkClient } from "@clerk/backend";
import { parsePublishableKey } from "@clerk/shared/keys";

const EXPECTED_INSTANCE_SUFFIX = "careful-pipefish-44.clerk.accounts.dev";

export function resolveClerkPublishableKey(): string {
  const key =
    process.env.CLERK_PUBLISHABLE_KEY ??
    process.env.VITE_CLERK_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key?.trim()) {
    throw new Error(
      "Missing Clerk publishable key. Set CLERK_PUBLISHABLE_KEY or VITE_CLERK_PUBLISHABLE_KEY (see artifacts/visaflow-e2e/.env.example).",
    );
  }
  return key.trim();
}

export function assertClerkSecretKeyLooksValid(secretKey: string): void {
  const trimmed = secretKey.trim();
  if (
    trimmed === "sk_test_..." ||
    trimmed.includes("...") ||
    trimmed.length < 40
  ) {
    throw new Error(
      "CLERK_SECRET_KEY looks like a placeholder. Copy the full secret from Clerk Dashboard → careful-pipefish-44 (Development) → API Keys.",
    );
  }
  if (!trimmed.startsWith("sk_test_")) {
    throw new Error(
      "CLERK_SECRET_KEY must be a Development secret (sk_test_…), not a production key (sk_live_…).",
    );
  }
}

export function assertPublishableKeyMatchesProject(publishableKey: string): void {
  const parsed = parsePublishableKey(publishableKey);
  const host = parsed?.frontendApi;
  if (!host) {
    throw new Error("Could not parse CLERK_PUBLISHABLE_KEY.");
  }
  if (!host.includes("careful-pipefish-44")) {
    throw new Error(
      `Publishable key targets ${host}, expected instance ${EXPECTED_INSTANCE_SUFFIX}. Use keys from the same Clerk Development instance as .replit.`,
    );
  }
}

/** Fail fast with a clear message before Playwright clerkSetup() calls the Testing Token API. */
export async function verifyClerkSecretKey(secretKey: string, publishableKey: string): Promise<void> {
  assertClerkSecretKeyLooksValid(secretKey);
  assertPublishableKeyMatchesProject(publishableKey);

  const clerk = createClerkClient({ secretKey: secretKey.trim() });
  try {
    await clerk.users.getUserList({ limit: 1 });
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "status" in err
        ? String((err as { status?: number }).status)
        : "";
    if (status === "401" || status === "403") {
      throw new Error(
        [
          "Clerk rejected CLERK_SECRET_KEY (Unauthorized).",
          "• Copy the secret key from the same Development instance as VITE_CLERK_PUBLISHABLE_KEY (careful-pipefish-44).",
          "• Do not paste the placeholder sk_test_… from the README.",
          "• In Clerk Dashboard → Restrictions, enable Testing tokens for this dev instance.",
        ].join("\n"),
      );
    }
    throw err;
  }
}
