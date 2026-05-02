import { db } from "@workspace/db";
import {
  countriesTable,
  workflowTemplatesTable,
  workflowStepsTable,
} from "@workspace/db/schema";
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

const STEPS = [
  { name: "Création du compte VisaFlow", isCampusFranceStep: false, requiredDocumentCategories: [] },
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
