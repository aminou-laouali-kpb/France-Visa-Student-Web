# Plan Visa Readiness — VisaFlow France

## Contexte produit

Cible : étudiants **admis en école privée**, procédure visa **hors Campus France / Études en France**.

## Phase 1 — Livré

- Parcours 16 étapes (seed + provisioning sans étapes CF actives)
- Visa Readiness Score + gating TLS/VFS / dépôt
- Pré-contrôle documents
- Simulateur entretien de motivation
- Dashboard étudiant : carte préparation visa

## Phase 2 — Livré

- Timeline proactive + notifications quotidiennes
- Portefeuille conseiller feu tricolore
- Playbooks (statiques puis DB)
- Analytics préparation visa

## Phase 3 — Livré (agents 1–7 intégrés)

- Docs / landing / i18n pivot privé
- Copilot + projet IA privé
- OpenAPI + codegen
- Playbooks admin CRUD + `AdminPlaybooks`
- Refus visa : motifs, analytics, `RefusalContextCard`
- AVI + validité passeport + règle 3 mois

## Phase 4 — À faire

- Tests E2E (parcours étudiant, portefeuille, gate TLS)
- Playbooks : routes OpenAPI CRUD `/playbooks`
- Notifications email sur jalons en retard
- Readiness score distinct du risk score
- Nettoyage legacy EEF / tables inutilisées
- Merge PR + smoke prod
