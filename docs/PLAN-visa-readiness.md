# Plan Visa Readiness — VisaFlow France

## Contexte produit

Cible : étudiants **admis en école privée**, procédure visa **hors Campus France / Études en France**.

## Phase 1 — Livré

- Parcours 16 étapes (seed + provisioning sans étapes CF actives)
- Visa Readiness Score + gating TLS/VFS / dépôt
- Pré-contrôle documents
- Simulateur entretien de motivation
- Dashboard étudiant : carte préparation visa

## Phase 2 — Livré (cette itération)

- **Timeline proactive** : jalons (étapes, documents critiques, échéances pays, RDV) via `GET /dashboard/student` → `timeline`
- **Portefeuille conseiller** : colonne feu tricolore (préparation visa), filtres, KPIs vert/orange
- **Playbooks** : SOPs contextuels `GET /students/:id/playbooks` + panneau conseiller
- **Analytics** : graphique préparation visa dans rapports (`byReadinessLevel`)

## Phase 3 — À faire

- Playbooks éditables (admin CRUD + base)
- Analytics refus (motifs, recours)
- Notifications proactives (email / push) sur jalons en retard
- Regénération OpenAPI complète (`readinessLevel` dans `StudentSummary`)

## Fichiers clés

| Domaine | Fichiers |
|--------|----------|
| Readiness | `artifacts/api-server/src/lib/risk.ts` |
| Timeline | `artifacts/api-server/src/lib/proactiveTimeline.ts` |
| Playbooks | `artifacts/api-server/src/lib/playbooks.ts` |
| UI étudiant | `ProactiveTimeline.tsx`, `StudentDashboard.tsx` |
| UI conseiller | `ReadinessTrafficLight.tsx`, `AdvisorPortfolio.tsx`, `PlaybookPanel.tsx` |
