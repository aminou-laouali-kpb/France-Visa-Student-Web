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

const PLAYBOOKS: Playbook[] = [
  {
    id: "admission-privee",
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
    id: "prep-entretien",
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
    id: "depot-tls",
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
    id: "visa-refuse",
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
    out.push(PLAYBOOKS.find((p) => p.id === "admission-privee")!);
  }
  if (
    stepNameMatches(step, "entretien") ||
    stepNameMatches(step, "motivation") ||
    stepNameMatches(step, "tls")
  ) {
    out.push(PLAYBOOKS.find((p) => p.id === "prep-entretien")!);
  }
  if (stepNameMatches(step, "tls") || stepNameMatches(step, "depot") || stepNameMatches(step, "visa")) {
    out.push(PLAYBOOKS.find((p) => p.id === "depot-tls")!);
  }
  if (opts.status === "visa_refused") {
    out.push(PLAYBOOKS.find((p) => p.id === "visa-refuse")!);
  }

  const seen = new Set<string>();
  return out.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}
