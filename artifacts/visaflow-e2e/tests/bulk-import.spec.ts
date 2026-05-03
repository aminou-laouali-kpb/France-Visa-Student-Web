/**
 * Regression test: cohort import duplicate-check is tenant-private.
 *
 * Seeds a student with email X in tenant B (id=2), then calls
 * POST /api/admin/import/preview as an admin whose tenant defaults to
 * tenant A (id=1).  The row must be reported as VALID — not duplicate and
 * not an error — because the email is only known to a different tenant.
 *
 * If the duplicate-check WHERE clause ever loses the `tenant_id = $tenantId`
 * filter, the seeded row will be found, the duplicate/error flag will be set,
 * and this test will fail.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "./fixtures/auth";
import { withDb } from "./fixtures/db";

test.describe("Bulk import — tenant isolation", () => {
  test("cross-tenant email is NOT flagged duplicate in /api/admin/import/preview", async ({
    page,
  }) => {
    const email = `cross-tenant-${Date.now().toString(36)}@e2e.test.local`;

    // ------------------------------------------------------------------ setup
    // Ensure tenant B (id=2) exists, then seed a student there with `email`.
    // The importing admin belongs to tenant A (id=1, the default when
    // users.tenant_id IS NULL), so the two tenants are always distinct.
    await withDb(async (db) => {
      await db.query(
        `INSERT INTO tenants (id, name, subdomain)
         VALUES (2, 'E2E Tenant B', 'e2e-tenant-b')
         ON CONFLICT (id) DO NOTHING`,
      );
      await db.query(
        `INSERT INTO students
           (tenant_id, first_name, last_name, email, status, completion_score)
         VALUES (2, 'Cross', 'Tenant', $1, 'active', 0)`,
        [email],
      );
    });

    try {
      // ----------------------------------------------------------- act
      await signInAs(page, "admin");

      // The admin's tenantId resolves to 1 (null → default 1 in the route).
      // We call the preview endpoint directly via the signed-in session.
      const csv = `first name,last name,email\nCross,Tenant,${email}`;
      const resp = await page.request.post("/api/admin/import/preview", {
        data: { format: "csv", content: csv },
      });

      // ----------------------------------------------------------- assert
      expect(resp.status()).toBe(200);

      const body = await resp.json();

      // There is exactly one data row in the CSV.
      expect(body.rows).toHaveLength(1);
      const row = body.rows[0];

      // Row must carry no errors and must NOT be flagged as duplicate.
      // This is the invariant that would break if the tenant filter were removed.
      expect(
        row.errors,
        "cross-tenant email must produce zero errors",
      ).toHaveLength(0);

      expect(
        row.resolved.duplicate,
        "cross-tenant email must not be marked duplicate",
      ).toBe(false);

      // Totals corroborate the row-level assertions.
      expect(body.totals.valid).toBe(1);
      expect(body.totals.duplicates).toBe(0);
      expect(body.totals.withErrors).toBe(0);
    } finally {
      // ----------------------------------------------------------- teardown
      await withDb(async (db) => {
        await db.query(`DELETE FROM students WHERE email = $1`, [email]);
      });
    }
  });
});
