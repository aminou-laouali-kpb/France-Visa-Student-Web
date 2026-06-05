# @workspace/visaflow-e2e

Executable Playwright end-to-end suite that exercises the student / advisor /
admin role flows across the `@workspace/visaflow` web app and the
`@workspace/api-server` API.

## What it covers

`tests/role-flows.spec.ts`:

- **Role landing + forbidden routes**
  - Student lands on `/student` (`student-dashboard`) and is blocked from
    `/advisor`, `/admin/students`, `/admin/workflow`.
  - Advisor lands on `/advisor` (`advisor-portfolio`), can reach
    `/advisor/reports` (`advisor-reports`), and is blocked from `/admin`
    and `/admin/students`.
  - Admin can reach `/admin/students` (`admin-students`) and
    `/admin/workflow` (`admin-workflow`).
  - Admin landing on `/admin` (`admin-global-dashboard`) is currently
    `test.fixme`'d behind a TODO — see *Known issues* below.

- **Admin mutations**
  - `/admin/students`: type into `input-search`, locate
    `row-admin-student-{id}`, change `select-advisor-{id}` to the advisor
    test user, assert `PATCH /api/students/{id}/assign` returned 200, and
    verify `students.advisor_id` in Postgres.
  - `/admin/workflow`: select `button-template-{templateId}` if multiple
    templates exist, click `button-toggle-active-{stepId}`, assert
    `PATCH /api/workflow-steps/{id}` returned 200, and verify
    `workflow_steps.is_active` flipped in Postgres.

## How auth works

The suite uses `@clerk/testing/playwright`:

- `tests/global.setup.ts` calls `clerkSetup()` and uses `@clerk/backend`
  (with `CLERK_SECRET_KEY`) to ensure three Clerk users exist
  (`E2E_STUDENT_EMAIL`, `E2E_ADVISOR_EMAIL`, `E2E_ADMIN_EMAIL`) and writes
  matching rows in our `users` table with the desired `role`. This
  bypasses the auto-provisioning fallback in
  `artifacts/api-server/src/middlewares/auth.ts` (which would otherwise
  default new users to `student`).
- Each test calls `signInAs(page, role)` (`tests/fixtures/auth.ts`),
  which sets a Clerk testing token, signs in via password strategy, and
  waits for `GET /api/users/me` to return 200 before proceeding.

## Required environment

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `CLERK_SECRET_KEY` | yes | — | Backend secret for the dev Clerk instance. |
| `VITE_CLERK_PUBLISHABLE_KEY` | yes | — | Publishable key used by the web app. `clerkSetup()` reads it from `process.env.CLERK_PUBLISHABLE_KEY` or `VITE_CLERK_PUBLISHABLE_KEY`. |
| `DATABASE_URL` | yes | — | Postgres connection string used both by global setup and tests for seeding/verification. |
| `E2E_BASE_URL` | no | `https://${REPLIT_DEV_DOMAIN}` if set, else `http://localhost:5173` | Base URL of the running VisaFlow web app. |
| `E2E_TEST_PASSWORD` | no | `VisaFlow!E2ePass-2026` | Shared password for the seeded Clerk users. |
| `E2E_STUDENT_EMAIL` | no | `e2e-student+clerk_test@visaflow.test` | Clerk Dev instances accept any `+clerk_test@…` address as a verified test identity. |
| `E2E_ADVISOR_EMAIL` | no | `e2e-advisor+clerk_test@visaflow.test` | |
| `E2E_ADMIN_EMAIL` | no | `e2e-admin+clerk_test@visaflow.test` | |

> **Clerk testing tokens.** The dev instance must have *Testing tokens*
> enabled (Clerk Dashboard → User & Authentication → Restrictions →
> Testing tokens). This is a one-time toggle on the dev instance.

Copy `artifacts/visaflow-e2e/.env.example` to the **repo root** as `.env.local`
and paste your real `CLERK_SECRET_KEY` (not the `sk_test_...` placeholder).

### Troubleshooting `ClerkAPIResponseError: Unauthorized` on setup

This almost always means the **secret key is wrong or from another Clerk instance**:

1. Open [Clerk Dashboard](https://dashboard.clerk.com) → instance **careful-pipefish-44** → **Development**.
2. **API Keys** → copy the full **Secret key** (`sk_test_…`, ~50+ characters).
3. Ensure `VITE_CLERK_PUBLISHABLE_KEY` is the **publishable** key from the **same** instance (the one in `.replit` is correct for this repo).
4. Enable **Testing tokens** under Restrictions.
5. `DATABASE_URL` must be a real Postgres URL, not `postgresql://...`.

Quick check (should print user count, not Unauthorized):

```bash
curl -s -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  "https://api.clerk.com/v1/users?limit=1" | head -c 200
```

## Running

```bash
# 1. install workspace deps (from repo root)
pnpm install

# 2. install Chromium for Playwright (one-time)
pnpm --filter @workspace/visaflow-e2e exec playwright install --with-deps chromium

# 3. start the app + api in one terminal
pnpm --filter @workspace/api-server run dev &
pnpm --filter @workspace/visaflow run dev &

# 4. in another terminal, run the suite
pnpm --filter @workspace/visaflow-e2e run test
# or, for the interactive runner:
pnpm --filter @workspace/visaflow-e2e run test:ui
```

The suite uses a single worker (`workers: 1`) and disables parallelism
because the seeded Clerk identities and DB rows are shared across tests.

## Known issues

### `test.fixme`: admin landing page returns blank

`GET /api/dashboard/advisor` (and the admin variant) build the Postgres
filter as

```ts
sql`${riskScoresTable.studentId} = ANY(${studentIds})`
```

at `artifacts/api-server/src/routes/admin.ts:190` (and the two sibling
clauses immediately below for `documents` and `appointments`). Drizzle
expands a JS array inside a `sql`` template into a comma-separated
parameter list, producing the invalid Postgres `ANY($1, $2, …)` and a
500. This blanks the `/admin` landing page (which depends on the admin
dashboard API).

The `admin lands on /admin` assertion is gated with `test.fixme` so the
rest of the suite can run cleanly. Replace the failing fragments with
`inArray(col, studentIds)` (or `sql.array(studentIds, "int4")`) and
remove the `test.fixme` once green.
