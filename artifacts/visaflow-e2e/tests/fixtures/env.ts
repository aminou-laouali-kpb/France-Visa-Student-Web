export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env var ${name}. See artifacts/visaflow-e2e/README.md for setup.`,
    );
  }
  return v;
}

export const TEST_PASSWORD =
  process.env.E2E_TEST_PASSWORD ?? "VisaFlow!E2ePass-2026";

export const ROLE_EMAILS = {
  student:
    process.env.E2E_STUDENT_EMAIL ?? "e2e-student+clerk_test@visaflow.test",
  advisor:
    process.env.E2E_ADVISOR_EMAIL ?? "e2e-advisor+clerk_test@visaflow.test",
  admin: process.env.E2E_ADMIN_EMAIL ?? "e2e-admin+clerk_test@visaflow.test",
} as const;

export type Role = keyof typeof ROLE_EMAILS;
