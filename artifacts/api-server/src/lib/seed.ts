import { db } from "@workspace/db";
import {
  countriesTable,
  workflowTemplatesTable,
  workflowStepsTable,
  studentsTable,
  studentStepsTable,
  checklistItemsTable,
  usersTable,
  tasksTable,
  notificationsTable,
} from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { logger } from "./logger";

const COUNTRIES = [
  { name: "Sénégal", code: "SN", requiresCampusFrance: true, visaCenter: "VFS Dakar" },
  { name: "Côte d'Ivoire", code: "CI", requiresCampusFrance: true, visaCenter: "VFS Abidjan" },
  { name: "Cameroun", code: "CM", requiresCampusFrance: false, visaCenter: "TLS Yaoundé" },
  { name: "Bénin", code: "BJ", requiresCampusFrance: false, visaCenter: "TLS Cotonou" },
  { name: "Burkina Faso", code: "BF", requiresCampusFrance: false, visaCenter: "TLS Ouagadougou" },
  { name: "Mali", code: "ML", requiresCampusFrance: false, visaCenter: "TLS Bamako" },
  { name: "Togo", code: "TG", requiresCampusFrance: false, visaCenter: "TLS Lomé" },
  { name: "Guinée", code: "GN", requiresCampusFrance: false, visaCenter: "TLS Conakry" },
  { name: "Niger", code: "NE", requiresCampusFrance: false, visaCenter: "TLS Niamey" },
  { name: "Madagascar", code: "MG", requiresCampusFrance: false, visaCenter: "TLS Antananarivo" },
];

interface SeedStep {
  name: string;
  isCampusFranceStep: boolean;
  requiredDocumentCategories: string[];
  // Default checklist applied per student at provisioning time
  checklist: { label: string; isRequired: boolean }[];
}

export const STEPS: SeedStep[] = [
  {
    name: "Création du compte VisaFlow",
    isCampusFranceStep: false, requiredDocumentCategories: [],
    checklist: [
      { label: "Compte créé et e-mail vérifié", isRequired: true },
      { label: "Téléphone WhatsApp confirmé", isRequired: false },
    ],
  },
  {
    name: "Renseignement du profil étudiant",
    isCampusFranceStep: false, requiredDocumentCategories: [],
    checklist: [
      { label: "Identité et état civil renseignés", isRequired: true },
      { label: "Coordonnées et nationalité confirmées", isRequired: true },
      { label: "Type de financement précisé", isRequired: true },
    ],
  },
  {
    name: "Téléversement du passeport",
    isCampusFranceStep: false, requiredDocumentCategories: ["passeport"],
    checklist: [
      { label: "Passeport valide >18 mois après l'arrivée", isRequired: true },
      { label: "Scan recto/verso lisible (PDF)", isRequired: true },
    ],
  },
  {
    name: "Téléversement des diplômes et relevés",
    isCampusFranceStep: false, requiredDocumentCategories: ["diplome", "releve_notes"],
    checklist: [
      { label: "Dernier diplôme obtenu téléversé", isRequired: true },
      { label: "Relevés de notes des 3 dernières années", isRequired: true },
      { label: "Traduction certifiée si non francophone", isRequired: false },
    ],
  },
  {
    name: "Test de langue (DELF/TCF/IELTS)",
    isCampusFranceStep: false, requiredDocumentCategories: ["test_langue"],
    checklist: [
      { label: "Inscription au test effectuée", isRequired: true },
      { label: "Résultat obtenu et téléversé", isRequired: true },
    ],
  },
  {
    name: "Choix de la formation et de l'école",
    isCampusFranceStep: false, requiredDocumentCategories: [],
    checklist: [
      { label: "Formation cible sélectionnée", isRequired: true },
      { label: "Établissement d'accueil confirmé", isRequired: true },
    ],
  },
  {
    name: "Création du dossier Études en France",
    isCampusFranceStep: true, requiredDocumentCategories: [],
    checklist: [
      { label: "Compte EEF créé", isRequired: true },
      { label: "CV et projet motivé renseignés", isRequired: true },
    ],
  },
  {
    name: "Préparation des pièces Campus France",
    isCampusFranceStep: true, requiredDocumentCategories: [],
    checklist: [
      { label: "Pièces administratives compilées", isRequired: true },
      { label: "Lettre de motivation finalisée", isRequired: true },
      { label: "CV format Campus France", isRequired: true },
    ],
  },
  {
    name: "Soumission du dossier Campus France",
    isCampusFranceStep: true, requiredDocumentCategories: [],
    checklist: [
      { label: "Dossier soumis dans les délais", isRequired: true },
      { label: "Frais Campus France réglés", isRequired: true },
    ],
  },
  {
    name: "Entretien Campus France",
    isCampusFranceStep: true, requiredDocumentCategories: [],
    checklist: [
      { label: "Convocation reçue", isRequired: true },
      { label: "Entretien réalisé", isRequired: true },
    ],
  },
  {
    name: "Avis Campus France obtenu",
    isCampusFranceStep: true, requiredDocumentCategories: ["attestation_campus_france"],
    checklist: [
      { label: "Attestation Campus France téléversée", isRequired: true },
    ],
  },
  {
    name: "Acceptation par l'établissement",
    isCampusFranceStep: false, requiredDocumentCategories: ["lettre_admission"],
    checklist: [
      { label: "Lettre d'admission reçue", isRequired: true },
      { label: "Frais de scolarité acquittés ou échéancier validé", isRequired: false },
    ],
  },
  {
    name: "Justificatif financier (compte bloqué/garant)",
    isCampusFranceStep: false, requiredDocumentCategories: ["justificatif_financier"],
    checklist: [
      { label: "Compte bloqué ouvert ou attestation de garant", isRequired: true },
      { label: "Montant ≥ 7 380 €", isRequired: true },
    ],
  },
  {
    name: "Justificatif d'hébergement",
    isCampusFranceStep: false, requiredDocumentCategories: ["justificatif_hebergement"],
    checklist: [
      { label: "Hébergement confirmé (CROUS / privé)", isRequired: true },
    ],
  },
  {
    name: "Souscription assurance santé",
    isCampusFranceStep: false, requiredDocumentCategories: ["assurance"],
    checklist: [
      { label: "Police d'assurance souscrite", isRequired: true },
    ],
  },
  {
    name: "Prise de rendez-vous TLS/VFS",
    isCampusFranceStep: false, requiredDocumentCategories: [],
    checklist: [
      { label: "Rendez-vous biométrique fixé", isRequired: true },
    ],
  },
  {
    name: "Constitution du dossier consulaire",
    isCampusFranceStep: false, requiredDocumentCategories: [],
    checklist: [
      { label: "Formulaire France-Visas complété", isRequired: true },
      { label: "Pièces consulaires assemblées", isRequired: true },
    ],
  },
  {
    name: "Dépôt du dossier visa",
    isCampusFranceStep: false, requiredDocumentCategories: [],
    checklist: [
      { label: "Dossier déposé au centre TLS/VFS", isRequired: true },
      { label: "Récépissé conservé", isRequired: true },
    ],
  },
  {
    name: "Décision visa",
    isCampusFranceStep: false, requiredDocumentCategories: [],
    checklist: [
      { label: "Décision reçue et notifiée à l'étudiant", isRequired: true },
    ],
  },
  {
    name: "Réservation billet d'avion",
    isCampusFranceStep: false, requiredDocumentCategories: ["billet_avion"],
    checklist: [
      { label: "Billet réservé après obtention du visa", isRequired: true },
    ],
  },
  {
    name: "Validation OFII et installation",
    isCampusFranceStep: false, requiredDocumentCategories: [],
    checklist: [
      { label: "Formulaire OFII envoyé à l'arrivée", isRequired: true },
      { label: "Visite médicale OFII effectuée", isRequired: false },
    ],
  },
];

export async function seedReferenceData(): Promise<void> {
  try {
    const existing = await db.select().from(countriesTable).limit(1);
    if (existing.length > 0) {
      logger.info("Seed skipped: data already present");
      return;
    }

    await db.insert(countriesTable).values(COUNTRIES);

    const [tpl] = await db
      .insert(workflowTemplatesTable)
      .values({
        name: "Procédure visa étudiant France — Standard",
        description: "Parcours en 21 étapes pour étudiants africains francophones",
        isDefault: true,
        version: 1,
      })
      .returning();

    await db.insert(workflowStepsTable).values(
      STEPS.map((s, i) => ({
        workflowTemplateId: tpl.id,
        name: s.name,
        order: i + 1,
        isCampusFranceStep: s.isCampusFranceStep,
        isRequired: true,
        isActive: true,
        requiredDocumentCategories: s.requiredDocumentCategories,
      })),
    );

    logger.info({ countries: COUNTRIES.length, steps: STEPS.length }, "Reference data seeded");
  } catch (err) {
    logger.error({ err }, "Seed failed");
  }
}

// ---------------------------------------------------------------------------
// Demo persona seed — gated by SEED_DEMO=1.
// Creates a small, idempotent set of users + students at varied stages so the
// admin/advisor dashboards have content out-of-the-box. The users use
// placeholder Clerk IDs (clerk_demo_*) — they will not be able to sign in
// through Clerk; this is purely DB-side fixture data for demos and
// integration testing.
// ---------------------------------------------------------------------------
const DEMO_USERS = [
  { clerkId: "clerk_demo_admin",     email: "demo-admin@visaflow.test",     firstName: "Aïcha",   lastName: "Diop",     role: "admin"     as const },
  { clerkId: "clerk_demo_advisor1",  email: "demo-advisor1@visaflow.test",  firstName: "Mamadou", lastName: "Sow",      role: "advisor"   as const },
  { clerkId: "clerk_demo_advisor2",  email: "demo-advisor2@visaflow.test",  firstName: "Fatou",   lastName: "Kane",     role: "advisor"   as const },
  { clerkId: "clerk_demo_reviewer",  email: "demo-reviewer@visaflow.test",  firstName: "Ibrahim", lastName: "Traoré",   role: "reviewer"  as const },
];

interface DemoStudent {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  status: "prospect" | "active" | "blocked" | "submitted" | "visa_obtained" | "visa_refused" | "withdrawn";
  // How many of the provisioned steps to mark validated (from step 1 upward).
  completedSteps: number;
  // Optional extra step status to apply on the very next step
  nextStepStatus?: "in_progress" | "submitted" | "blocked";
  blockedReason?: string;
  hasVisaRefusalHistory?: boolean;
  advisorIdx: 0 | 1; // which advisor (0 or 1)
}

const DEMO_STUDENTS: DemoStudent[] = [
  { firstName: "Awa",      lastName: "Ndiaye",   email: "awa.ndiaye@demo.test",     countryCode: "SN", status: "active",       completedSteps: 2,  nextStepStatus: "in_progress", advisorIdx: 0 },
  { firstName: "Cheikh",   lastName: "Fall",     email: "cheikh.fall@demo.test",    countryCode: "SN", status: "active",       completedSteps: 6,  nextStepStatus: "in_progress", advisorIdx: 0 },
  { firstName: "Aminata",  lastName: "Bamba",    email: "aminata.bamba@demo.test",  countryCode: "CI", status: "blocked",      completedSteps: 4,  nextStepStatus: "blocked",     blockedReason: "Test de langue insuffisant — TCF B1, requis B2", advisorIdx: 1 },
  { firstName: "Yacouba",  lastName: "Koné",     email: "yacouba.kone@demo.test",   countryCode: "ML", status: "active",       completedSteps: 9,  nextStepStatus: "submitted",   advisorIdx: 1 },
  { firstName: "Sandrine", lastName: "Mballa",   email: "sandrine.mballa@demo.test",countryCode: "CM", status: "submitted",    completedSteps: 14, nextStepStatus: "in_progress", advisorIdx: 0 },
  { firstName: "Boureima", lastName: "Ouédraogo",email: "boureima.o@demo.test",     countryCode: "BF", status: "active",       completedSteps: 11, nextStepStatus: "in_progress", hasVisaRefusalHistory: true, advisorIdx: 1 },
  { firstName: "Marie",    lastName: "Houngbo",  email: "marie.houngbo@demo.test",  countryCode: "BJ", status: "visa_obtained",completedSteps: 18, advisorIdx: 0 },
  { firstName: "Salif",    lastName: "Camara",   email: "salif.camara@demo.test",   countryCode: "GN", status: "visa_refused", completedSteps: 16, hasVisaRefusalHistory: true, advisorIdx: 1 },
];

export async function seedDemoPersonas(): Promise<void> {
  if (process.env["SEED_DEMO"] !== "1") return;
  try {
    // Idempotent: skip if any demo user already present.
    const [marker] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, "clerk_demo_admin"));
    if (marker) {
      logger.info("Demo seed skipped: demo personas already present");
      return;
    }

    // Insert users
    const userRows = await db.insert(usersTable).values(DEMO_USERS).returning();
    const byClerkId = new Map(userRows.map((u) => [u.clerkId, u]));
    const admin = byClerkId.get("clerk_demo_admin")!;
    const advisors = [
      byClerkId.get("clerk_demo_advisor1")!,
      byClerkId.get("clerk_demo_advisor2")!,
    ];
    const reviewer = byClerkId.get("clerk_demo_reviewer")!;

    // Country lookup
    const countryRows = await db.select().from(countriesTable);
    const countryByCode = new Map(countryRows.map((c) => [c.code, c]));

    const [tpl] = await db
      .select()
      .from(workflowTemplatesTable)
      .where(eq(workflowTemplatesTable.isDefault, true));
    if (!tpl) {
      logger.warn("Demo seed: default workflow template missing — aborting");
      return;
    }
    const allSteps = await db
      .select()
      .from(workflowStepsTable)
      .where(eq(workflowStepsTable.workflowTemplateId, tpl.id))
      .orderBy(asc(workflowStepsTable.order));
    const checklistByStepName = new Map(STEPS.map((s) => [s.name, s.checklist]));

    let created = 0;
    for (const ds of DEMO_STUDENTS) {
      const country = countryByCode.get(ds.countryCode);
      if (!country) continue;
      const advisor = advisors[ds.advisorIdx];

      // Compute simple risk score: 0–100, low/medium/high
      let risk = 25;
      if (ds.hasVisaRefusalHistory) risk += 25;
      if (ds.nextStepStatus === "blocked") risk += 30;
      if (ds.completedSteps < 5) risk += 10;
      risk = Math.min(100, risk);

      const [student] = await db
        .insert(studentsTable)
        .values({
          firstName: ds.firstName,
          lastName: ds.lastName,
          email: ds.email,
          countryId: country.id,
          advisorId: advisor.id,
          reviewerId: reviewer.id,
          status: ds.status,
          completionScore: Math.round((ds.completedSteps / 21) * 100),
          hasVisaRefusalHistory: !!ds.hasVisaRefusalHistory,
          financingType: ds.completedSteps > 10 ? "compte_bloque" : "garant",
        })
        .returning();

      // Provision steps + checklists, applying completion progression
      const requiresCampusFrance = !!country.requiresCampusFrance;
      const applicable = allSteps.filter(
        (s) => !(s.isCampusFranceStep && !requiresCampusFrance),
      );
      for (let i = 0; i < applicable.length; i++) {
        const step = applicable[i];
        let status: "not_started" | "in_progress" | "validated" | "blocked" | "submitted" = "not_started";
        if (i < ds.completedSteps) status = "validated";
        else if (i === ds.completedSteps && ds.nextStepStatus) status = ds.nextStepStatus;

        await db.insert(studentStepsTable).values({
          studentId: student.id,
          workflowStepId: step.id,
          stepName: step.name,
          stepOrder: step.order,
          isCampusFranceStep: step.isCampusFranceStep,
          isRequired: step.isRequired,
          status,
          completedAt: status === "validated" ? new Date() : null,
          blockedReason: status === "blocked" ? ds.blockedReason ?? null : null,
        });
        const items = checklistByStepName.get(step.name) ?? [];
        if (items.length > 0) {
          await db.insert(checklistItemsTable).values(
            items.map((it, idx) => ({
              workflowStepId: step.id,
              studentId: student.id,
              label: it.label,
              isRequired: it.isRequired,
              isChecked: status === "validated",
              checkedAt: status === "validated" ? new Date() : null,
              checkedBy: status === "validated" ? advisor.id : null,
              order: idx,
            })),
          );
        }
      }

      // Open task for blocked / in-progress demos
      if (ds.nextStepStatus === "blocked") {
        await db.insert(tasksTable).values({
          studentId: student.id,
          title: "Débloquer l'étape",
          description: ds.blockedReason ?? "À traiter en priorité",
          assignedToId: advisor.id,
          createdById: admin.id,
          priority: "critical",
        });
      } else if (ds.nextStepStatus === "submitted") {
        await db.insert(tasksTable).values({
          studentId: student.id,
          title: "Examiner la soumission",
          assignedToId: advisor.id,
          createdById: admin.id,
          priority: "high",
        });
      }

      // Notification to advisor
      await db.insert(notificationsTable).values({
        userId: advisor.id,
        studentId: student.id,
        title: "Dossier démo assigné",
        message: `${ds.firstName} ${ds.lastName} (${country.name}) — niveau de risque ${risk}/100`,
        type: risk > 60 ? "warning" : "info",
      });
      created += 1;
    }

    logger.info(
      { users: userRows.length, students: created },
      "Demo personas seeded",
    );
  } catch (err) {
    logger.error({ err }, "Demo seed failed");
  }
}
