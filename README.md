# VisaFlow France

Application SaaS pour gérer la procédure de **visa étudiant français** des étudiants déjà admis dans une école privée en France (hors Campus France et Études en France).

## Fonctionnalités

- **Trois espaces, cinq rôles** :
  - **Étudiant** : son dossier, ses documents, ses rendez-vous, ses messages et ses notifications.
  - **Conseiller et examinateur** : portefeuille d'étudiants, relecture des documents, tâches et rapports.
  - **Admin et super-admin** : utilisateurs, écoles, pays, modèles de procédure, import en masse, calendrier, journal d'audit.
- **Procédure en 16 étapes**, de l'admission jusqu'à l'arrivée en France.
- **Préparation au visa** : situation financière, profil, relecture du projet d'études, entretien.
- **Génération de PDF**, export Excel et stockage des documents.
- **Abonnements Stripe** et notifications par SMS et WhatsApp (Twilio).
- Interface en plusieurs langues (i18next), double authentification.

## Stack

- Monorepo pnpm, TypeScript
- Frontend : React, Vite, Wouter, TanStack Query, shadcn/ui, Clerk
- API : Express, Clerk, Drizzle ORM, PostgreSQL
- Stockage Google Cloud, Stripe, Twilio
- Tests de bout en bout avec Playwright

## Structure

```
artifacts/visaflow/        application web
artifacts/api-server/      API Express, montée sur /api
artifacts/visaflow-e2e/    tests Playwright
lib/db/                    schémas et migrations Drizzle
lib/api-spec/              contrat OpenAPI
lib/api-client-react/      hooks TanStack Query générés
lib/ai/                    fonctions d'IA partagées
docs/                      guides équipe et étudiants
```

## Démarrer en local

```bash
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/visaflow run dev
```

Principales variables d'environnement :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | base PostgreSQL |
| `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | authentification Clerk |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY` | paiements |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM` | SMS et WhatsApp |
| `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` | stockage des fichiers |

Le premier compte créé devient automatiquement super-admin. Plus de détails dans [`replit.md`](replit.md) et le dossier [`docs/`](docs).

## Origine

Projet développé sur [Replit](https://replit.com) et maintenu par KPB Education.
