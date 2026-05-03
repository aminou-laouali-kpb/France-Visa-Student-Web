import { expect, type Page } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { ROLE_EMAILS, TEST_PASSWORD, type Role } from "./env";

/**
 * Sign in to the VisaFlow web app as the given role using Clerk's testing
 * helpers, and wait for the React app to finish provisioning the user
 * (i.e. for `GET /api/users/me` to return 200).
 *
 * Roles are pre-seeded by `global.setup.ts` (Clerk user + DB row with the
 * desired `users.role`).
 */
export async function signInAs(page: Page, role: Role): Promise<void> {
  await setupClerkTestingToken({ page });
  await page.goto("/");

  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: ROLE_EMAILS[role],
      password: TEST_PASSWORD,
    },
  });

  const meResponse = page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/users/me") &&
      resp.request().method() === "GET" &&
      resp.status() === 200,
    { timeout: 20_000 },
  );
  await page.goto("/app");
  await meResponse;
  await expect(page).toHaveURL(/\/(app|student|advisor|admin)/);
}

export async function signOut(page: Page): Promise<void> {
  await clerk.signOut({ page });
}
