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
  schoolsTable,
  programsTable,
  scholarshipsTable,
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
  { name: "Maroc", code: "MA", requiresCampusFrance: true, visaCenter: "TLS Casablanca" },
];

// Reference catalog of French schools commonly chosen by francophone African
// students. Includes flagship business/engineering schools (INSEEC, ECE) plus
// public universities — gives the school/program selection screens real
// content out-of-the-box.
const SCHOOLS: { name: string; city: string; website?: string; programs: { name: string; level: string; duration?: string }[] }[] = [
  {
    name: "INSEEC Grande École",
    city: "Paris",
    website: "https://www.inseec.com",
    programs: [
      { name: "Bachelor in Business", level: "bachelor", duration: "3 ans" },
      { name: "MSc International Business", level: "master", duration: "2 ans" },
      { name: "MBA Finance", level: "mba", duration: "1 an" },
    ],
  },
  {
    name: "ECE — École Centrale d'Électronique",
    city: "Paris",
    website: "https://www.ece.fr",
    programs: [
      { name: "Cycle Ingénieur Informatique", level: "ingenieur", duration: "5 ans" },
      { name: "Bachelor Cybersécurité", level: "bachelor", duration: "3 ans" },
      { name: "MSc Data & AI", level: "master", duration: "2 ans" },
    ],
  },
  {
    name: "Sorbonne Université",
    city: "Paris",
    website: "https://www.sorbonne-universite.fr",
    programs: [
      { name: "Licence Économie-Gestion", level: "licence", duration: "3 ans" },
      { name: "Master Droit International", level: "master", duration: "2 ans" },
    ],
  },
  {
    name: "Université Paris-Saclay",
    city: "Saclay",
    website: "https://www.universite-paris-saclay.fr",
    programs: [
      { name: "Licence Informatique", level: "licence", duration: "3 ans" },
      { name: "Master Mathématiques Appliquées", level: "master", duration: "2 ans" },
    ],
  },
  {
    name: "Université de Lyon",
    city: "Lyon",
    website: "https://www.universite-lyon.fr",
    programs: [
      { name: "Licence Sciences de la Vie", level: "licence", duration: "3 ans" },
      { name: "Master Santé Publique", level: "master", duration: "2 ans" },
    ],
  },
  {
    name: "EM Lyon Business School",
    city: "Lyon",
    website: "https://em-lyon.com",
    programs: [
      { name: "Programme Grande École", level: "master", duration: "3 ans" },
      { name: "MSc International Hospitality Management", level: "master", duration: "1 an" },
    ],
  },
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
    name: "Préparation à l'entretien de motivation",
    isCampusFranceStep: false, requiredDocumentCategories: [],
    checklist: [
      { label: "Simulateur d'entretien réalisé au moins une fois", isRequired: false },
      { label: "Motivation et projet maîtrisés à l'oral", isRequired: true },
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

const SCHOLARSHIPS = [
  {
    code: "BGF",
    name: "Bourse du Gouvernement Français (BGF)",
    provider: "Campus France / Ambassade de France",
    description:
      "Bourse d'excellence couvrant frais de scolarité, allocation mensuelle, sécurité sociale et voyage.",
    coversTuition: true,
    coversLiving: true,
    monthlyAmountEur: 700,
    countryCode: null,
    isActive: true,
  },
  {
    code: "EIFFEL",
    name: "Bourse Eiffel",
    provider: "Ministère de l'Europe et des Affaires étrangères",
    description:
      "Programme d'excellence pour Master et Doctorat, allocation mensuelle de 1 181€ (Master) à 1 700€ (Doctorat).",
    coversTuition: false,
    coversLiving: true,
    monthlyAmountEur: 1181,
    countryCode: null,
    isActive: true,
  },
  {
    code: "AUF",
    name: "Bourse AUF",
    provider: "Agence Universitaire de la Francophonie",
    description:
      "Bourses de mobilité Master/Doctorat pour étudiants francophones, allocation forfaitaire mensuelle.",
    coversTuition: false,
    coversLiving: true,
    monthlyAmountEur: 1000,
    countryCode: null,
    isActive: true,
  },
  {
    code: "ERASMUS_PLUS",
    name: "Erasmus+",
    provider: "Commission européenne",
    description:
      "Bourse de mobilité internationale pour étudiants inscrits dans une université partenaire.",
    coversTuition: false,
    coversLiving: true,
    monthlyAmountEur: 850,
    countryCode: null,
    isActive: true,
  },
  {
    code: "BOURSE_SN",
    name: "Bourse d'État du Sénégal",
    provider: "Ministère de l'Enseignement supérieur du Sénégal",
    description:
      "Bourse d'État sénégalaise pour étudiants admis dans une université française.",
    coversTuition: true,
    coversLiving: true,
    monthlyAmountEur: 615,
    countryCode: "SN",
    isActive: true,
  },
  {
    code: "BOURSE_CI",
    name: "Bourse d'État de Côte d'Ivoire",
    provider: "Ministère de l'Enseignement supérieur de Côte d'Ivoire",
    description:
      "Bourse d'État ivoirienne pour études en France.",
    coversTuition: true,
    coversLiving: true,
    monthlyAmountEur: 615,
    countryCode: "CI",
    isActive: true,
  },
];

async function seedScholarships(): Promise<void> {
  const existing = await db.select().from(scholarshipsTable);
  const existingCodes = new Set(existing.map((s) => s.code));
  const toInsert = SCHOLARSHIPS.filter((s) => !existingCodes.has(s.code));
  if (toInsert.length > 0) {
    await db.insert(scholarshipsTable).values(toInsert);
    logger.info(`Seeded ${toInsert.length} scholarships`);
  }
}

export async function seedReferenceData(): Promise<void> {
  // Each dataset (countries, workflow template, workflow steps, schools,
  // programs) is checked and inserted independently so that pre-populated
  // databases still receive newly-added reference data on upgrade. The
  // function is safe to run on every startup.
  try {
    // Countries — insert any code that does not already exist.
    const existingCountries = await db.select().from(countriesTable);
    const existingCountryCodes = new Set(existingCountries.map((c) => c.code));
    const newCountries = COUNTRIES.filter((c) => !existingCountryCodes.has(c.code));
    if (newCountries.length > 0) {
      await db.insert(countriesTable).values(newCountries);
    }

    // Workflow template — find the default; create only if missing.
    let [tpl] = await db
      .select()
      .from(workflowTemplatesTable)
      .where(eq(workflowTemplatesTable.isDefault, true));
    if (!tpl) {
      [tpl] = await db
        .insert(workflowTemplatesTable)
        .values({
          name: "Procédure visa étudiant France — Standard",
          description: "Parcours en 21 étapes pour étudiants africains francophones",
          isDefault: true,
          version: 1,
        })
        .returning();
    }

    // Workflow steps — insert any name that does not already exist for the
    // default template (preserves existing step ids / student references).
    const existingSteps = await db
      .select()
      .from(workflowStepsTable)
      .where(eq(workflowStepsTable.workflowTemplateId, tpl.id));
    const existingStepNames = new Set(existingSteps.map((s) => s.name));
    const newSteps = STEPS
      .map((s, i) => ({
        workflowTemplateId: tpl.id,
        name: s.name,
        order: i + 1,
        isCampusFranceStep: s.isCampusFranceStep,
        isRequired: true,
        isActive: true,
        requiredDocumentCategories: s.requiredDocumentCategories,
      }))
      .filter((s) => !existingStepNames.has(s.name));
    if (newSteps.length > 0) {
      await db.insert(workflowStepsTable).values(newSteps);
    }

    // Schools — insert any school whose name is not already present, with
    // its programs attached.
    const existingSchoolRows = await db.select().from(schoolsTable);
    const existingSchoolNames = new Set(existingSchoolRows.map((s) => s.name));
    let schoolsSeeded = 0;
    let programsSeeded = 0;
    for (const s of SCHOOLS) {
      if (existingSchoolNames.has(s.name)) {
        // School exists; backfill any missing programs by name match.
        const [schoolRow] = await db
          .select()
          .from(schoolsTable)
          .where(eq(schoolsTable.name, s.name));
        if (!schoolRow) continue;
        const existingPrograms = await db
          .select()
          .from(programsTable)
          .where(eq(programsTable.schoolId, schoolRow.id));
        const existingProgramNames = new Set(existingPrograms.map((p) => p.name));
        const newPrograms = s.programs
          .filter((p) => !existingProgramNames.has(p.name))
          .map((p) => ({
            schoolId: schoolRow.id,
            name: p.name,
            level: p.level,
            duration: p.duration ?? null,
          }));
        if (newPrograms.length > 0) {
          await db.insert(programsTable).values(newPrograms);
          programsSeeded += newPrograms.length;
        }
        continue;
      }
      const [school] = await db
        .insert(schoolsTable)
        .values({ name: s.name, city: s.city, website: s.website ?? null })
        .returning();
      schoolsSeeded += 1;
      if (s.programs.length > 0) {
        await db.insert(programsTable).values(
          s.programs.map((p) => ({
            schoolId: school.id,
            name: p.name,
            level: p.level,
            duration: p.duration ?? null,
          })),
        );
        programsSeeded += s.programs.length;
      }
    }

    await seedScholarships();

    logger.info(
      {
        countriesAdded: newCountries.length,
        stepsAdded: newSteps.length,
        schoolsAdded: schoolsSeeded,
        programsAdded: programsSeeded,
      },
      "Reference data sync complete",
    );
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
