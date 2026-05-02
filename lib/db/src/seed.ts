import { db, pool } from "./index";
import {
  countriesTable,
  schoolsTable,
  programsTable,
  workflowTemplatesTable,
  workflowStepsTable,
} from "./schema";
import { eq } from "drizzle-orm";

const COUNTRIES = [
  { name: "Sénégal", code: "SN", requiresCampusFrance: true, visaCenter: "TLScontact Dakar" },
  { name: "Côte d'Ivoire", code: "CI", requiresCampusFrance: true, visaCenter: "VFS Global Abidjan" },
  { name: "Cameroun", code: "CM", requiresCampusFrance: true, visaCenter: "TLScontact Yaoundé" },
  { name: "Mali", code: "ML", requiresCampusFrance: true, visaCenter: "VFS Global Bamako" },
  { name: "Guinée", code: "GN", requiresCampusFrance: false, visaCenter: "VFS Global Conakry" },
  { name: "Togo", code: "TG", requiresCampusFrance: true, visaCenter: "VFS Global Lomé" },
  { name: "Bénin", code: "BJ", requiresCampusFrance: true, visaCenter: "VFS Global Cotonou" },
  { name: "Burkina Faso", code: "BF", requiresCampusFrance: true, visaCenter: "VFS Global Ouagadougou" },
  { name: "Madagascar", code: "MG", requiresCampusFrance: true, visaCenter: "VFS Global Antananarivo" },
  { name: "République Démocratique du Congo", code: "CD", requiresCampusFrance: false, visaCenter: "VFS Global Kinshasa" },
];

const SCHOOLS = [
  { name: "Université Paris-Saclay", city: "Paris", website: "https://www.universite-paris-saclay.fr" },
  { name: "Sorbonne Université", city: "Paris", website: "https://www.sorbonne-universite.fr" },
  { name: "Sciences Po", city: "Paris", website: "https://www.sciencespo.fr" },
  { name: "INSA Lyon", city: "Lyon", website: "https://www.insa-lyon.fr" },
  { name: "Université de Bordeaux", city: "Bordeaux", website: "https://www.u-bordeaux.fr" },
  { name: "Université Grenoble Alpes", city: "Grenoble", website: "https://www.univ-grenoble-alpes.fr" },
  { name: "École Polytechnique", city: "Palaiseau", website: "https://www.polytechnique.edu" },
  { name: "HEC Paris", city: "Jouy-en-Josas", website: "https://www.hec.edu" },
];

const PROGRAMS_PER_SCHOOL = [
  { name: "Licence Informatique", level: "Licence", duration: "3 ans" },
  { name: "Master Intelligence Artificielle", level: "Master", duration: "2 ans" },
  { name: "Master Management International", level: "Master", duration: "2 ans" },
  { name: "Doctorat Sciences", level: "Doctorat", duration: "3 ans" },
];

const WORKFLOW_STEPS = [
  { name: "Création du compte étudiant", description: "Inscription sur la plateforme et configuration du profil", isCampusFranceStep: false },
  { name: "Vérification de l'identité", description: "Soumission de la pièce d'identité et passeport", isCampusFranceStep: false, requiredDocumentCategories: ["passeport", "piece_identite"] },
  { name: "Choix du programme et de l'école", description: "Sélection définitive du programme d'études en France", isCampusFranceStep: false },
  { name: "Préparation des documents académiques", description: "Diplômes, relevés de notes, attestations", isCampusFranceStep: false, requiredDocumentCategories: ["diplome", "releve_notes"] },
  { name: "Test de langue française", description: "TCF, DELF ou DALF selon le programme", isCampusFranceStep: false, requiredDocumentCategories: ["test_langue"] },
  { name: "Création du dossier Études en France", description: "Inscription sur la plateforme Campus France", isCampusFranceStep: true },
  { name: "Saisie des vœux Campus France", description: "Choix des formations sur la plateforme", isCampusFranceStep: true },
  { name: "Entretien Campus France", description: "Entretien obligatoire avec un conseiller", isCampusFranceStep: true },
  { name: "Validation du dossier Campus France", description: "Confirmation par Campus France", isCampusFranceStep: true },
  { name: "Réception de l'attestation pré-consulaire", description: "Document essentiel pour la demande de visa", isCampusFranceStep: true, requiredDocumentCategories: ["attestation_campus_france"] },
  { name: "Acceptation par l'établissement", description: "Lettre d'admission de l'école", isCampusFranceStep: false, requiredDocumentCategories: ["lettre_admission"] },
  { name: "Justificatifs financiers", description: "Preuve de ressources (7380€/an minimum)", isCampusFranceStep: false, requiredDocumentCategories: ["justificatif_financier"] },
  { name: "Justificatif d'hébergement", description: "Attestation de logement en France", isCampusFranceStep: false, requiredDocumentCategories: ["justificatif_hebergement"] },
  { name: "Assurance santé", description: "Attestation d'assurance maladie internationale", isCampusFranceStep: false, requiredDocumentCategories: ["assurance"] },
  { name: "Prise de rendez-vous TLS/VFS", description: "Rendez-vous au centre de demande de visa", isCampusFranceStep: false },
  { name: "Constitution du dossier visa", description: "Compilation finale de tous les documents", isCampusFranceStep: false },
  { name: "Dépôt du dossier au consulat", description: "Présence physique au centre TLS/VFS", isCampusFranceStep: false },
  { name: "Suivi de la demande France-Visas", description: "Vérification du statut sur france-visas.gouv.fr", isCampusFranceStep: false },
  { name: "Récupération du passeport", description: "Retour au centre TLS/VFS pour récupérer le visa", isCampusFranceStep: false },
  { name: "Préparation au départ", description: "Billets, OFII, premiers contacts en France", isCampusFranceStep: false, requiredDocumentCategories: ["billet_avion"] },
  { name: "Validation du visa à l'arrivée (OFII)", description: "Démarche obligatoire dans les 3 mois après arrivée", isCampusFranceStep: false },
];

async function seed() {
  console.log("🌱 Seeding database...");

  // Idempotent: skip if already seeded
  const existing = await db.select().from(countriesTable).limit(1);
  if (existing.length > 0) {
    console.log("⚠️  Database already seeded — clearing reference data and re-seeding workflow + countries + schools");
  }

  // Countries
  for (const c of COUNTRIES) {
    const [existing] = await db.select().from(countriesTable).where(eq(countriesTable.code, c.code));
    if (!existing) {
      await db.insert(countriesTable).values(c);
      console.log(`  ✓ Country: ${c.name}`);
    }
  }

  // Schools + programs
  for (const s of SCHOOLS) {
    const [existing] = await db.select().from(schoolsTable).where(eq(schoolsTable.name, s.name));
    let schoolId: number;
    if (!existing) {
      const [inserted] = await db.insert(schoolsTable).values(s).returning();
      schoolId = inserted.id;
      console.log(`  ✓ School: ${s.name}`);
    } else {
      schoolId = existing.id;
    }
    for (const p of PROGRAMS_PER_SCHOOL) {
      const [existingP] = await db
        .select()
        .from(programsTable)
        .where(eq(programsTable.name, p.name));
      if (!existingP || existingP.schoolId !== schoolId) {
        await db.insert(programsTable).values({ ...p, schoolId });
      }
    }
  }

  // Default workflow template
  let [tpl] = await db
    .select()
    .from(workflowTemplatesTable)
    .where(eq(workflowTemplatesTable.name, "Visa Étudiant France — Standard"));
  if (!tpl) {
    [tpl] = await db
      .insert(workflowTemplatesTable)
      .values({
        name: "Visa Étudiant France — Standard",
        description: "Parcours standard 21 étapes pour visa étudiant France (incluant Campus France si requis)",
        isDefault: true,
        version: 1,
      })
      .returning();
    console.log(`  ✓ Workflow template: ${tpl.name}`);
  }

  // Workflow steps
  for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
    const step = WORKFLOW_STEPS[i];
    const [existing] = await db
      .select()
      .from(workflowStepsTable)
      .where(eq(workflowStepsTable.workflowTemplateId, tpl.id));
    // Only insert if step at this order doesn't exist
    const existsAtOrder = await db
      .select()
      .from(workflowStepsTable)
      .where(eq(workflowStepsTable.workflowTemplateId, tpl.id));
    if (!existsAtOrder.find((s) => s.order === i + 1)) {
      await db.insert(workflowStepsTable).values({
        workflowTemplateId: tpl.id,
        name: step.name,
        description: step.description,
        order: i + 1,
        isCampusFranceStep: step.isCampusFranceStep,
        isRequired: true,
        isActive: true,
        requiredDocumentCategories: step.requiredDocumentCategories ?? [],
      });
    }
  }
  console.log(`  ✓ Workflow steps: ${WORKFLOW_STEPS.length} steps`);

  console.log("✅ Seed complete");
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
