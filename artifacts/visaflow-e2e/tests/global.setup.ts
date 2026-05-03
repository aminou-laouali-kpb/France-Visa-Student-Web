import { test as setup, expect } from "@playwright/test";
import { clerkSetup } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { Client } from "pg";
import { ROLE_EMAILS, TEST_PASSWORD, requireEnv } from "./fixtures/env";

setup("clerk + seed users + assign roles", async () => {
  await clerkSetup();

  const secretKey = requireEnv("CLERK_SECRET_KEY");
  const databaseUrl = requireEnv("DATABASE_URL");

  const clerk = createClerkClient({ secretKey });
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  try {
    for (const [role, email] of Object.entries(ROLE_EMAILS) as Array<
      [keyof typeof ROLE_EMAILS, string]
    >) {
      const list = await clerk.users.getUserList({ emailAddress: [email] });
      let user = list.data[0];

      if (!user) {
        user = await clerk.users.createUser({
          emailAddress: [email],
          password: TEST_PASSWORD,
          firstName: role,
          lastName: "E2E",
          skipPasswordChecks: true,
        });
      }

      await db.query(
        `INSERT INTO users (clerk_id, email, first_name, last_name, role, is_active)
         VALUES ($1, $2, $3, 'E2E', $4, true)
         ON CONFLICT (clerk_id) DO UPDATE
           SET role = EXCLUDED.role,
               email = EXCLUDED.email,
               is_active = true`,
        [user.id, email, role, role],
      );
    }

    const { rows } = await db.query<{ role: string; count: string }>(
      `SELECT role, count(*)::text AS count FROM users
       WHERE email = ANY($1) GROUP BY role`,
      [Object.values(ROLE_EMAILS)],
    );
    const seenRoles = new Set(rows.map((r) => r.role));
    for (const role of Object.keys(ROLE_EMAILS)) {
      expect(seenRoles, `role ${role} must exist in users table`).toContain(role);
    }
  } finally {
    await db.end();
  }
});
