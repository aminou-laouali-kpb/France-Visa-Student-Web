/**
 * Contextual advisor playbooks (SOPs) — static v1, keyed by dossier status and step.
 */

export interface PlaybookStep {
  order: number;
  title: string;
  detail: string;
}

export interface Playbook {
  id: string;
  title: string;
  when: string;
  steps: PlaybookStep[];
}

export const PLAYBOOKS: Playbook[] = [
  {
    id: "admission",
    title: "Admission école privée confirmée",
    when: "Lettre d'admission reçue, dossier actif",
    steps: [
      {
        order: 1,
        title: "Vérifier la lettre d'admission",
        detail:
          "PDF lisible, nom conforme au passeport, dates et programme cohérents avec le profil.",
      },
      {
        order: 2,
        title: "Bloquer le justificatif financier",
        detail: "Montant ≥ seuil légal, document daté de moins de 3 mois, nom du titulaire clair.",
      },
      {
        order: 3,
        title: "Planifier TLS/VFS",
        detail:
          "Réserver le créneau dans la fenêtre recommandée (≈30 j avant la rentrée) et l'enregistrer dans VisaFlow.",
      },
    ],
  },
  {
    id: "entretien",
    title: "Préparation entretien de motivation",
    when: "Étape entretien ou avant RDV consulaire",
    steps: [
      {
        order: 1,
        title: "Faire réaliser le simulateur",
        detail: "Au moins une session complète ; relever les axes faibles (motivation, français, projet).",
      },
      {
        order: 2,
        title: "Aligner discours et documents",
        detail: "Programme, financement et projet pro doivent être identiques entre CV, lettre et oral.",
      },
      {
        order: 3,
        title: "Brief RDV / école",
        detail: "Rappeler tenue, ponctualité, pièces papier et originaux si demandés.",
      },
    ],
  },
  {
    id: "tls",
    title: "Dépôt TLS/VFS et dossier consulaire",
    when: "Avant validation des étapes TLS ou dépôt visa",
    steps: [
      {
        order: 1,
        title: "Pré-contrôle documents",
        detail: "Utiliser l'onglet Documents et corriger les alertes avant le rendez-vous.",
      },
      {
        order: 2,
        title: "Checklist France-Visas",
        detail: "Formulaire, photos, assurance, hébergement, billets si requis selon le pays.",
      },
      {
        order: 3,
        title: "Après dépôt",
        detail: "Mettre à jour le statut de l'étape et noter le numéro de suivi dans les RDV.",
      },
    ],
  },
  {
    id: "refus",
    title: "Suite à un refus de visa",
    when: "Statut visa_refused",
    steps: [
      {
        order: 1,
        title: "Analyser le motif",
        detail: "Demander la notification officielle et classer : documents, finances, motivation, autre.",
      },
      {
        order: 2,
        title: "Lettre explicative",
        detail: "Documenter les éléments renforcés depuis le refus (finances, projet, liens avec le pays d'origine).",
      },
      {
        order: 3,
        title: "Nouveau calendrier",
        detail: "Réviser la rentrée ou le report ; recalculer le score de préparation avant un nouveau dépôt.",
      },
    ],
  },
];

function stepNameMatches(name: string, fragment: string): boolean {
  const n = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const f = fragment.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return n.includes(f);
}

export function resolvePlaybooksForStudent(opts: {
  status: string;
  currentStepName: string | null;
}): Playbook[] {
  const out: Playbook[] = [];
  const step = opts.currentStepName ?? "";

  if (["active", "submitted", "prospect"].includes(opts.status)) {
    out.push(PLAYBOOKS.find((p) => p.id === "admission")!);
  }
  if (
    stepNameMatches(step, "entretien") ||
    stepNameMatches(step, "motivation") ||
    stepNameMatches(step, "tls")
  ) {
    out.push(PLAYBOOKS.find((p) => p.id === "entretien")!);
  }
  if (stepNameMatches(step, "tls") || stepNameMatches(step, "depot") || stepNameMatches(step, "visa")) {
    out.push(PLAYBOOKS.find((p) => p.id === "tls")!);
  }
  if (opts.status === "visa_refused") {
    out.push(PLAYBOOKS.find((p) => p.id === "refus")!);
  }

  const seen = new Set<string>();
  return out.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

import { db, playbooksTable, playbookStepsTable, type PlaybookPhase } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
export type PlaybookAdminStep = { id?: number; title: string; body: string; sortOrder: number; checklist: string[] };
export type PlaybookAdmin = { id?: number; slug: string; title: string; description: string | null; phase: PlaybookPhase; isActive: boolean; sortOrder: number; steps: PlaybookAdminStep[] };
function rowToAdvisor(slug: string, title: string, description: string | null, steps: { sortOrder: number; title: string; body: string }[]): Playbook {
  return { id: slug, title, when: description ?? "", steps: steps.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map(s=>({order:s.sortOrder,title:s.title,detail:s.body})) };
}
function rowToAdmin(playbook: typeof playbooksTable.$inferSelect, steps: (typeof playbookStepsTable.$inferSelect)[]): PlaybookAdmin {
  return { id: playbook.id, slug: playbook.slug, title: playbook.title, description: playbook.description, phase: playbook.phase as PlaybookPhase, isActive: playbook.isActive, sortOrder: playbook.sortOrder, steps: steps.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map(s=>({id:s.id,title:s.title,body:s.body,sortOrder:s.sortOrder,checklist:s.checklist??[]})) };
}
export async function loadPlaybooksFromDb(): Promise<PlaybookAdmin[]|null> {
  const playbooks = await db.select().from(playbooksTable).orderBy(asc(playbooksTable.sortOrder), asc(playbooksTable.id));
  if (!playbooks.length) return null;
  const allSteps = await db.select().from(playbookStepsTable).orderBy(asc(playbookStepsTable.sortOrder), asc(playbookStepsTable.id));
  const by = new Map<number, typeof allSteps>();
  for (const s of allSteps) { const l = by.get(s.playbookId) ?? []; l.push(s); by.set(s.playbookId, l); }
  return playbooks.map(p => rowToAdmin(p, by.get(p.id) ?? []));
}
export function staticToAdminCatalog(): PlaybookAdmin[] {
  return PLAYBOOKS.map((p, idx) => ({ slug: p.id, title: p.title, description: p.when, phase: p.id as PlaybookPhase, isActive: true, sortOrder: idx+1, steps: p.steps.map(s=>({title:s.title,body:s.detail,sortOrder:s.order,checklist:[] as string[]})) }));
}
export async function getPlaybooksAdminCatalog() { const fromDb = await loadPlaybooksFromDb(); return fromDb ? { source: "database" as const, playbooks: fromDb } : { source: "static" as const, playbooks: staticToAdminCatalog() }; }
async function loadAdvisorFromDb(): Promise<Playbook[]|null> {
  const admin = await loadPlaybooksFromDb(); if (!admin) return null;
  return admin.filter(p=>p.isActive).map(p=>rowToAdvisor(p.slug,p.title,p.description,p.steps.map(s=>({sortOrder:s.sortOrder,title:s.title,body:s.body}))));
}
export async function resolvePlaybooksForStudentAsync(opts: { status: string; currentStepName: string | null }) {
  const playbooks = resolvePlaybooksForStudent(opts);
  const fromDb = await loadAdvisorFromDb();
  if (!fromDb) return { source: "static" as const, playbooks };
  const byId = new Map(fromDb.map(p=>[p.id,p]));
  return { source: "database" as const, playbooks: playbooks.map(p=>byId.get(p.id) ?? p) };
}
export async function seedDefaultPlaybooks(): Promise<void> {
  const existing = new Set((await db.select({ slug: playbooksTable.slug }).from(playbooksTable)).map(r=>r.slug));
  for (const pb of staticToAdminCatalog()) {
    if (existing.has(pb.slug)) continue;
    const [created] = await db.insert(playbooksTable).values({ slug: pb.slug, title: pb.title, description: pb.description, phase: pb.phase, isActive: pb.isActive, sortOrder: pb.sortOrder }).returning();
    if (pb.steps.length) await db.insert(playbookStepsTable).values(pb.steps.map(s=>({ playbookId: created.id, title: s.title, body: s.body, sortOrder: s.sortOrder, checklist: s.checklist })));
  }
}
