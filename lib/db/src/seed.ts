import { db, pool } from "./index";
import {
  countriesTable,
  schoolsTable,
  programsTable,
  workflowTemplatesTable,
  workflowStepsTable,
  usersTable,
} from "./schema";
import { eq } from "drizzle-orm";

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
      { name: "Global BBA", level: "bachelor", duration: "4 ans" },
    ],
  },
];

// Canonical 21-step parcours (must stay aligned with the api-server runtime
// seed in artifacts/api-server/src/lib/seed.ts so that the two seeds do not
// duplicate workflow_steps rows when both run).
const STEPS = [
  { name: "Création du compte VisaFlow", isCampusFranceStep: false, requiredDocumentCategories: [] as string[] },
  { name: "Renseignement du profil étudiant", isCampusFranceStep: false, requiredDocumentCategories: [] },
  { name: "Téléversement du passeport", isCampusFranceStep: false, requiredDocumentCategories: ["passeport"] },
  { name: "Téléversement des diplômes et relevés", isCampusFranceStep: false, requiredDocumentCategories: ["diplome", "releve_notes"] },
  { name: "Test de langue (DELF/TCF/IELTS)", isCampusFranceStep: false, requiredDocumentCategories: ["test_langue"] },
  { name: "Choix de la formation et de l'école", isCampusFranceStep: false, requiredDocumentCategories: [] },
  { name: "Création du dossier Études en France", isCampusFranceStep: true, requiredDocumentCategories: [] },
  { name: "Préparation des pièces Campus France", isCampusFranceStep: true, requiredDocumentCategories: [] },
  { name: "Soumission du dossier Campus France", isCampusFranceStep: true, requiredDocumentCategories: [] },
  { name: "Entretien Campus France", isCampusFranceStep: true, requiredDocumentCategories: [] },
  { name: "Avis Campus France obtenu", isCampusFranceStep: true, requiredDocumentCategories: ["attestation_campus_france"] },
  { name: "Acceptation par l'établissement", isCampusFranceStep: false, requiredDocumentCategories: ["lettre_admission"] },
  { name: "Justificatif financier (compte bloqué/garant)", isCampusFranceStep: false, requiredDocumentCategories: ["justificatif_financier"] },
  { name: "Justificatif d'hébergement", isCampusFranceStep: false, requiredDocumentCategories: ["justificatif_hebergement"] },
  { name: "Souscription assurance santé", isCampusFranceStep: false, requiredDocumentCategories: ["assurance"] },
  { name: "Prise de rendez-vous TLS/VFS", isCampusFranceStep: false, requiredDocumentCategories: [] },
  { name: "Constitution du dossier consulaire", isCampusFranceStep: false, requiredDocumentCategories: [] },
  { name: "Dépôt du dossier visa", isCampusFranceStep: false, requiredDocumentCategories: [] },
  { name: "Décision visa", isCampusFranceStep: false, requiredDocumentCategories: [] },
  { name: "Réservation billet d'avion", isCampusFranceStep: false, requiredDocumentCategories: ["billet_avion"] },
  { name: "Validation OFII et installation", isCampusFranceStep: false, requiredDocumentCategories: [] },
];

async function seed() {
  console.log("🌱 Seeding reference data…");

  // Countries — insert by missing code.
  const existingCountries = await db.select().from(countriesTable);
  const existingCodes = new Set(existingCountries.map((c) => c.code));
  const newCountries = COUNTRIES.filter((c) => !existingCodes.has(c.code));
  if (newCountries.length > 0) {
    await db.insert(countriesTable).values(newCountries);
    console.log(`  ✓ ${newCountries.length} country/ies added`);
  }

  // Schools — insert by missing name; backfill missing programs by name.
  const existingSchools = await db.select().from(schoolsTable);
  const schoolByName = new Map(existingSchools.map((s) => [s.name, s]));
  for (const s of SCHOOLS) {
    let schoolId: number;
    const existing = schoolByName.get(s.name);
    if (!existing) {
      const [inserted] = await db
        .insert(schoolsTable)
        .values({ name: s.name, city: s.city, website: s.website })
        .returning();
      schoolId = inserted.id;
      console.log(`  ✓ School: ${s.name}`);
    } else {
      schoolId = existing.id;
    }
    const existingPrograms = await db
      .select()
      .from(programsTable)
      .where(eq(programsTable.schoolId, schoolId));
    const existingProgNames = new Set(existingPrograms.map((p) => p.name));
    const newPrograms = s.programs
      .filter((p) => !existingProgNames.has(p.name))
      .map((p) => ({ ...p, schoolId }));
    if (newPrograms.length > 0) {
      await db.insert(programsTable).values(newPrograms);
    }
  }

  // Default workflow template — find or create.
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
    console.log(`  ✓ Workflow template: ${tpl.name}`);
  }

  // Workflow steps — insert by missing name within the default template
  // (preserves any existing student_steps FK references).
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
    console.log(`  ✓ ${newSteps.length} workflow step(s) added`);
  }

  // Bootstrap superadmin user from environment if requested. Required env:
  //   SUPERADMIN_CLERK_ID    — Clerk user id (e.g. user_xxx)
  //   SUPERADMIN_EMAIL       — email address
  //   SUPERADMIN_FIRST_NAME  — optional, defaults to "Super"
  //   SUPERADMIN_LAST_NAME   — optional, defaults to "Admin"
  // Skips silently if SUPERADMIN_CLERK_ID is not set so the seed remains
  // safe to run in environments without a designated bootstrap admin.
  const clerkId = process.env.SUPERADMIN_CLERK_ID;
  const email = process.env.SUPERADMIN_EMAIL;
  if (clerkId && email) {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkId));
    if (!existing) {
      await db.insert(usersTable).values({
        clerkId,
        email,
        firstName: process.env.SUPERADMIN_FIRST_NAME ?? "Super",
        lastName: process.env.SUPERADMIN_LAST_NAME ?? "Admin",
        role: "superadmin",
        isActive: true,
      });
      console.log(`  ✓ Superadmin user bootstrapped (${email})`);
    } else if (existing.role !== "superadmin") {
      await db
        .update(usersTable)
        .set({ role: "superadmin", isActive: true })
        .where(eq(usersTable.clerkId, clerkId));
      console.log(`  ✓ Superadmin role granted to existing user (${email})`);
    }
  } else {
    console.log("  – Superadmin bootstrap skipped (SUPERADMIN_CLERK_ID/SUPERADMIN_EMAIL not set)");
  }

  console.log("✅ Seed complete");
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
