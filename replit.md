# VisaFlow France

SaaS web app to manage French student visa procedures for Francophone African students.

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

- 21-step default workflow seeded at startup. Steps 7–11 are Campus France steps and are **skipped at provisioning** when the student's country has `requiresCampusFrance = false`.
- Documents go via Replit object storage: presigned PUT → register row → reviewer validates/rejects → notification fired.
- Comments support internal-only and "demande de correction" flags.
- Risk score (lib/risk.ts) computed from missing/rejected documents, overdue tasks, missing CF steps, missing appointments, prior visa refusal.
- Audit log written for every mutating route.

## Key files

- `artifacts/api-server/src/app.ts` — Express setup, Clerk middleware, proxy.
- `artifacts/api-server/src/middlewares/auth.ts` — `requireAuth`, `requireRole`, first-user-superadmin.
- `artifacts/api-server/src/routes/` — students, documents, collab, admin, reference, users.
- `artifacts/api-server/src/lib/{risk,audit,seed}.ts` — risk scoring, audit logging, startup seed.
- `artifacts/visaflow/src/App.tsx` — Wouter router with `base={BASE_URL}`, Clerk Show gates, Protected wrapper.
- `artifacts/visaflow/src/components/Layout.tsx` — Role-aware sidebar.
- `artifacts/visaflow/src/pages/StudentDetail.tsx` — 7 tabs (Parcours / Documents / Commentaires / Tâches / RDV / Risque / Profil).

## Running

All three workflows run via `pnpm --filter <pkg> run dev`. Workflows are managed by Replit. PostgreSQL DB is provided via `DATABASE_URL`. Object storage via `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`. Clerk via `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (set automatically by the Auth pane).

## Notes / known shortcuts

- Frontend casts dashboard / student responses to `any` in places — the backend returns richer shapes than the OpenAPI spec describes; spec was not regenerated.
- Document upload uses raw `fetch` (window.Clerk session token) to call `/storage/upload-url` because the spec's upload-url body shape diverged from what the route expects.
- `useGetMe` triggers user provisioning on first call (the GET /api/users/me handler creates the row).
