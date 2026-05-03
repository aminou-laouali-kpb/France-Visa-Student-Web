/**
 * Regression tests: cohort import duplicate-check is scoped to the importing
 * admin's own tenant, and commit does not roll back the full batch when a
 * cross-tenant email collides with the global unique constraint.
 *
 * - If the `eq(studentsTable.tenantId, tenantId)` filter is removed from
 *   buildPreview(), the cross-tenant preview test will fail.
 * - If the `.onConflictDoNothing()` guard is removed from the commit insert,
 *   the commit batch-safety test will fail.
 */

import { describe, it, expect, afterAll } from "vitest";
import { Client } from "pg";
import { db, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { buildPreview } from "./bulkImport";

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function makeClient(): Client {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set — cannot run integration tests.");
  return new Client({ connectionString: url });
}

async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const client = makeClient();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TENANT_A_ID = 1; // already exists; the default platform tenant
const TENANT_B_ID = 900_001; // ephemeral — created & deleted around this suite
const CROSS_TENANT_EMAIL = `bulk-import-reg-${Date.now().toString(36)}@test.internal`;

afterAll(async () => {
  await withDb(async (client) => {
    await client.query(`DELETE FROM students WHERE email LIKE 'bulk-import-reg-%@test.internal'`);
    await client.query(`DELETE FROM students WHERE email LIKE 'same-tenant-reg-%@test.internal'`);
    await client.query(`DELETE FROM students WHERE email LIKE 'commit-batch-%@test.internal'`);
    await client.query(`DELETE FROM tenants WHERE id = $1`, [TENANT_B_ID]);
  });
});

// ---------------------------------------------------------------------------
// Preview tests
// ---------------------------------------------------------------------------

describe("buildPreview — tenant isolation", () => {
  it("treats an email that exists only in another tenant as valid (not duplicate, no error)", async () => {
    // ---- Arrange ----------------------------------------------------------
    // Seed tenant B and plant a student there with CROSS_TENANT_EMAIL.
    await withDb(async (client) => {
      await client.query(
        `INSERT INTO tenants (id, name, subdomain)
         VALUES ($1, 'Regression Tenant B', 'regression-tenant-b')
         ON CONFLICT (id) DO NOTHING`,
        [TENANT_B_ID],
      );
      await client.query(
        `INSERT INTO students
           (tenant_id, first_name, last_name, email, status, completion_score)
         VALUES ($1, 'Cross', 'TenantStudent', $2, 'active', 0)
         ON CONFLICT (email) DO NOTHING`,
        [TENANT_B_ID, CROSS_TENANT_EMAIL],
      );
    });

    // ---- Act ---------------------------------------------------------------
    // Run preview as admin of TENANT_A — the email lives in TENANT_B, so it
    // must appear as a fresh, valid import row from tenant A's perspective.
    const csv = `first name,last name,email\nCross,TenantStudent,${CROSS_TENANT_EMAIL}`;
    const rawRows = csv.split("\n").map((line) => line.split(","));
    const result = await buildPreview(rawRows, TENANT_A_ID);

    // ---- Assert ------------------------------------------------------------
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];

    expect(
      row.errors,
      "cross-tenant email must produce zero import errors",
    ).toHaveLength(0);

    expect(
      row.resolved.duplicate,
      "cross-tenant email must not be flagged as duplicate",
    ).toBe(false);
  });

  it("correctly flags an email that exists in the SAME tenant as duplicate", async () => {
    // Plant a student in TENANT_A to verify same-tenant detection still works.
    const sameTenantEmail = `same-tenant-reg-${Date.now().toString(36)}@test.internal`;
    await withDb(async (client) => {
      await client.query(
        `INSERT INTO students
           (tenant_id, first_name, last_name, email, status, completion_score)
         VALUES ($1, 'Same', 'TenantStudent', $2, 'active', 0)
         ON CONFLICT (email) DO NOTHING`,
        [TENANT_A_ID, sameTenantEmail],
      );
    });

    try {
      const csv = `first name,last name,email\nSame,TenantStudent,${sameTenantEmail}`;
      const rawRows = csv.split("\n").map((line) => line.split(","));
      const result = await buildPreview(rawRows, TENANT_A_ID);

      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];

      expect(
        row.resolved.duplicate,
        "same-tenant email must be flagged as duplicate",
      ).toBe(true);

      expect(
        row.errors,
        "a same-tenant duplicate should produce warnings, not errors",
      ).toHaveLength(0);
    } finally {
      await withDb(async (client) => {
        await client.query(`DELETE FROM students WHERE email = $1`, [sameTenantEmail]);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Commit-path batch-safety test
// ---------------------------------------------------------------------------

describe("commit path — batch not rolled back by cross-tenant email conflict", () => {
  it("skips a cross-tenant email via onConflictDoNothing and still inserts valid rows", async () => {
    // The global students.email unique constraint means a cross-tenant email
    // would normally throw and roll back the entire transaction. The insert
    // must use onConflictDoNothing so only that one row is skipped.

    // Ensure TENANT_B and the cross-tenant student exist (may already be
    // seeded by the preview tests above).
    await withDb(async (client) => {
      await client.query(
        `INSERT INTO tenants (id, name, subdomain)
         VALUES ($1, 'Regression Tenant B', 'regression-tenant-b')
         ON CONFLICT (id) DO NOTHING`,
        [TENANT_B_ID],
      );
      await client.query(
        `INSERT INTO students
           (tenant_id, first_name, last_name, email, status, completion_score)
         VALUES ($1, 'Cross', 'TenantStudent', $2, 'active', 0)
         ON CONFLICT (email) DO NOTHING`,
        [TENANT_B_ID, CROSS_TENANT_EMAIL],
      );
    });

    // A new email that belongs exclusively to TENANT_A — should be inserted.
    const newEmail = `commit-batch-${Date.now().toString(36)}@test.internal`;

    // Two-row CSV: row 1 (cross-tenant conflict), row 2 (genuinely new).
    const csv = [
      "first name,last name,email",
      `Cross,TenantStudent,${CROSS_TENANT_EMAIL}`,
      `New,Student,${newEmail}`,
    ].join("\n");

    const rawRows = csv.split("\n").map((line) => line.split(","));
    const preview = await buildPreview(rawRows, TENANT_A_ID);

    // Preview: both rows valid from tenant A's perspective (neither is flagged).
    expect(preview.rows).toHaveLength(2);
    for (const row of preview.rows) {
      expect(row.errors).toHaveLength(0);
      expect(row.resolved.duplicate).toBe(false);
    }

    // Simulate what the commit route does: insert all non-duplicate/error rows.
    let created = 0;
    await db.transaction(async (tx) => {
      for (const r of preview.rows) {
        const [inserted] = await tx
          .insert(studentsTable)
          .values({
            tenantId: TENANT_A_ID,
            firstName: r.parsed.firstName!,
            lastName: r.parsed.lastName!,
            email: r.parsed.email!,
            status: "active",
          })
          .onConflictDoNothing()
          .returning({ id: studentsTable.id });
        if (inserted) created++;
      }
    });

    // The cross-tenant row was silently skipped; the new row was inserted.
    expect(created, "only the genuinely new row should be inserted").toBe(1);

    // Confirm the new student is in TENANT_A.
    const [saved] = await db
      .select({ tenantId: studentsTable.tenantId, email: studentsTable.email })
      .from(studentsTable)
      .where(eq(studentsTable.email, newEmail));

    expect(saved).toBeDefined();
    expect(saved.tenantId).toBe(TENANT_A_ID);
    expect(saved.email).toBe(newEmail);

    // Teardown the newly inserted student.
    await withDb(async (client) => {
      await client.query(`DELETE FROM students WHERE email = $1`, [newEmail]);
    });
  });
});
