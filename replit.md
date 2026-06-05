# VisaFlow France

SaaS web app to manage French student visa procedures for students **already admitted to a private French school** (hors Campus France / Études en France).

## Architecture

Monorepo (pnpm workspaces) with three artifacts:

- **artifacts/api-server** — Express + Clerk + Drizzle (PostgreSQL). Mounted at `/api`. Seeds reference data on first startup.
- **artifacts/visaflow** — React + Vite + Wouter + TanStack Query + shadcn/ui (the web app). Mounted at `/`.
- **artifacts/mockup-sandbox** — Internal preview server for components.

Shared libraries:
- `lib/db` — Drizzle schemas and migrations (PostgreSQL).
- `lib/api-spec` — OpenAPI definition.
- `lib/api-client-react` — Generated TanStack Query hooks (`@workspace/api-client-react`).

## Roles & Spaces

Three spaces, five roles:
- **Étudiant space** (role `student`) — own dossier, documents, appointments, notifications.
- **Conseiller/Examinateur space** (roles `advisor`, `reviewer`) — assigned students, review documents, manage tasks.
- **Admin space** (roles `admin`, `superadmin`) — users, audit, schools, countries, workflow templates, dashboards.

The first user to sign up automatically becomes `superadmin`. Subsequent users default to `student` and provision a Clerk-linked record on first authenticated request.

## Auth

Clerk (web) via `@clerk/react`:
- Dev: Clerk JS loads directly from Clerk CDN.
- Prod: served via `/api/__clerk` proxy on api-server.
- Frontend uses `useAuth().getToken()` → `Authorization: Bearer …` for all API calls (registered via `setAuthTokenGetter`).
- Backend `clerkMiddleware` reads bearer token; `requireAuth` provisions user in DB on first request.

## Data flow & workflow

- **16-step active workflow** for private-school visa (admission → TLS/VFS or consulate → post-arrival). Template has 21 steps; steps 7–11 (Campus France / EEF) are **skipped at provisioning** when `requiresCampusFrance = false`.
- Documents go via Replit object storage: presigned PUT → register row → reviewer validates/rejects → notification fired.
- Comments support internal-only and "demande de correction" flags.
- Risk score computed from missing/rejected documents (including admission letter), overdue tasks, missing appointments, prior visa refusal.
- Audit log written for every mutating route.

## Key files

- `artifacts/api-server/src/app.ts` — Express setup, Clerk middleware, proxy.
- `artifacts/api-server/src/middlewares/auth.ts` — `requireAuth`, `requireRole`, first-user-superadmin.
- `artifacts/api-server/src/lib/seed.ts` — Private-uni workflow steps, private school catalog, startup seed.
- `artifacts/api-server/src/routes/` — students, documents, collab, admin, reference, users.
- `artifacts/visaflow/src/App.tsx` — Wouter router with `base={BASE_URL}`, Clerk Show gates, Protected wrapper.
- `artifacts/visaflow/src/pages/Onboarding.tsx` — 5-step onboarding ending with admission confirmation (school, program, intake).

## Running

All three workflows run via `pnpm --filter <pkg> run dev`. Workflows are managed by Replit. PostgreSQL DB is provided via `DATABASE_URL`. Object storage via `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`. Clerk via `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (set automatically by the Auth pane).
