import {
  db,
  studentsTable,
  documentsTable,
  tasksTable,
  appointmentsTable,
  studentStepsTable,
  riskScoresTable,
  type Document,
  type RiskScore,
  type Student,
  financialProofsTable,
  countriesTable,
  type VisaRefusalMotifCode,
} from "@workspace/db";
import { eq, and, lt, ne } from "drizzle-orm";
import { computeRefusalMotifFlags, refusalMotifFlagIds } from "./refusalRisk";

const MOTIF_SCORE: Record<VisaRefusalMotifCode, number> = {"1":12,"2":18,"3":10,"4":8,"5":8,"6":20,"7":10};
const MOTIF_REC: Record<VisaRefusalMotifCode, string> = {"1":"Renforcer identité/passeport","2":"Compléter justificatifs financiers","3":"Assurance conforme","4":"Clarifier le projet","5":"Prouver admission","6":"Finaliser Campus France","7":"Renouveler pièces expirées"};

const STEP_DELAY_THRESHOLD_DAYS = 60;
const DEPARTURE_OFFSET_DAYS = 30;
const APPOINTMENT_PROXIMITY_DAYS = 30;
const TLS_INTAKE_LOOKAHEAD_DAYS = 120;
const PROFILE_COMPLETENESS_THRESHOLD = 70;

export const TLS_STEP_NAME = "Prise de rendez-vous TLS/VFS";
export const VISA_DEPOSIT_STEP_NAME = "Dépôt du dossier visa";

const PROFILE_FIELDS: (keyof Student)[] = [
  "phone",
  "dateOfBirth",
  "nationalityCode",
  "passportNumber",
  "passportExpiry",
  "financingType",
  "visaType",
  "countryId",
];

type VisaSignals = {
  missingDocs: number;
  rejectedDocs: number;
  missingLettreAdmission: boolean;
  missingJustificatifFinancier: boolean;
  overdueTasks: number;
  delayedSteps: number;
  missingTlsAppointment: boolean;
  appointmentOutsideWindow: boolean;
  hasVisaRefusal: boolean;
  lowProfileCompleteness: boolean;
  profilePct: number;
};

export function documentCategoryIsMissing(docs: Document[], category: string): boolean {
  const inCat = docs.filter((d) => d.category === category);
  if (inCat.length === 0) return true;
  return inCat.every((d) => d.status === "missing");
}

function profileCompletenessPct(student: Student): number {
  const filled = PROFILE_FIELDS.filter((k) => {
    const v = student[k];
    return v !== null && v !== undefined && String(v).trim() !== "";
  }).length;
  return PROFILE_FIELDS.length > 0 ? Math.round((filled / PROFILE_FIELDS.length) * 100) : 100;
}

function hasStudentProgramProfile(student: Student): boolean {
  return !!(student.schoolId && student.programId && student.intakeDate);
}

function buildRecommendations(signals: VisaSignals, daysToIntake: number | null): string[] {
  const candidates: Array<{ p: number; t: string }> = [];

  if (signals.missingLettreAdmission) {
    candidates.push({
      p: 95,
      t: "Téléverser la lettre d'admission officielle (PDF lisible, en français ou avec traduction).",
    });
  }
  if (signals.missingJustificatifFinancier) {
    candidates.push({
      p: 93,
      t: "Téléverser un justificatif financier récent conforme au montant requis (compte bloqué, garant ou ressources).",
    });
  }
  if (signals.rejectedDocs > 0) {
    candidates.push({
      p: 90,
      t: `Corriger et re-soumettre ${signals.rejectedDocs} document(s) rejeté(s) en suivant les commentaires du conseiller.`,
    });
  }
  if (signals.missingTlsAppointment) {
    candidates.push({
      p: 85,
      t: "Réserver un rendez-vous TLS/VFS (ou Capago) et l'enregistrer dans VisaFlow.",
    });
  }
  if (signals.missingDocs > 0) {
    candidates.push({
      p: 80,
      t: `Compléter ${signals.missingDocs} document(s) manquant(s) dans l'onglet Documents avant le dépôt consulaire.`,
    });
  }
  if (signals.delayedSteps > 0 && daysToIntake !== null) {
    candidates.push({
      p: 75,
      t: `Finaliser ${signals.delayedSteps} étape(s) requise(s) en retard — rentrée dans ${daysToIntake} jour(s).`,
    });
  }
  if (signals.overdueTasks > 0) {
    candidates.push({
      p: 70,
      t: `Traiter ${signals.overdueTasks} tâche(s) en retard dans votre tableau de bord.`,
    });
  }
  if (signals.hasVisaRefusal) {
    candidates.push({
      p: 60,
      t: "Préparer une lettre explicative détaillée sur le refus précédent et les éléments renforcés du nouveau dossier.",
    });
  }
  if (signals.lowProfileCompleteness) {
    candidates.push({
      p: 55,
      t: `Compléter votre profil dossier (${signals.profilePct}% renseigné) : passeport, financement et coordonnées à jour.`,
    });
  }

  const picked = candidates
    .sort((a, b) => b.p - a.p)
    .slice(0, 5)
    .map((c) => c.t);

  if (picked.length === 0) {
    return ["Dossier en bonne voie — continuer le suivi régulier."];
  }
  if (picked.length < 3) {
    picked.push("Vérifier l'ensemble des pièces et le calendrier avant le dépôt.");
  }
  return picked;
}

export function visaStepGateMessage(docs: Document[], stepName: string): string | null {
  if (stepName !== TLS_STEP_NAME && stepName !== VISA_DEPOSIT_STEP_NAME) return null;

  const missing: string[] = [];
  if (documentCategoryIsMissing(docs, "lettre_admission")) missing.push("la lettre d'admission");
  if (documentCategoryIsMissing(docs, "justificatif_financier")) missing.push("le justificatif financier");

  if (missing.length === 0) return null;
  return `Impossible de valider « ${stepName} » : téléversez ${missing.join(" et ")} avant de poursuivre.`;
}

export async function getVisaReadinessSummary(studentId: number): Promise<{
  studentId: number;
  score: number;
  level: "low" | "medium" | "high";
  recommendations: string[];
}> {
  const risk = await calculateRiskScore(studentId);
  return {
    studentId,
    score: risk.score,
    level: risk.level,
    recommendations: risk.recommendations ?? [],
  };
}

export async function calculateRiskScore(studentId: number): Promise<RiskScore> {
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  if (!student) throw new Error("Student not found");

  const docs = await db.select().from(documentsTable).where(eq(documentsTable.studentId, studentId));
  const missingDocs = docs.filter((d) => d.status === "missing").length;
  const rejectedDocs = docs.filter((d) => d.status === "rejected").length;

  const overdueTasks = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.studentId, studentId),
        lt(tasksTable.dueDate, new Date()),
        ne(tasksTable.status, "done"),
      ),
    );

  const allSteps = await db
    .select()
    .from(studentStepsTable)
    .where(eq(studentStepsTable.studentId, studentId));

  const now = new Date();
  let intakeDate: Date | null = null;
  if (student.intakeDate) {
    const parsed = new Date(student.intakeDate);
    if (!isNaN(parsed.getTime())) intakeDate = parsed;
  }
  const expectedDeparture = intakeDate
    ? new Date(intakeDate.getTime() - DEPARTURE_OFFSET_DAYS * 86400000)
    : null;
  const daysToIntake = intakeDate
    ? Math.floor((intakeDate.getTime() - now.getTime()) / 86400000)
    : null;
  const daysToDeparture = expectedDeparture
    ? Math.floor((expectedDeparture.getTime() - now.getTime()) / 86400000)
    : null;

  let delayedSteps = 0;
  if (intakeDate && daysToIntake !== null && daysToIntake <= STEP_DELAY_THRESHOLD_DAYS) {
    delayedSteps = allSteps.filter(
      (s) => s.isRequired && (s.status === "not_started" || s.status === "blocked"),
    ).length;
  }

  const upcomingApts = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(eq(appointmentsTable.studentId, studentId), eq(appointmentsTable.status, "upcoming")),
    );

  const tlsStep = allSteps.find((s) => s.stepName === TLS_STEP_NAME);
  const tlsStepPending = tlsStep && tlsStep.status !== "validated";
  const hasTlsAppointment = upcomingApts.some((a) => a.type === "tls_vfs" || a.type === "capago");
  const nearIntake =
    daysToIntake === null || (daysToIntake <= TLS_INTAKE_LOOKAHEAD_DAYS && daysToIntake >= 0);
  const missingTlsAppointment =
    student.status === "active" && !!tlsStepPending && !hasTlsAppointment && nearIntake;

  let appointmentOutsideWindow = false;
  if (expectedDeparture && upcomingApts.length > 0 && daysToDeparture !== null && daysToDeparture > 0) {
    const minMs = (daysToDeparture - APPOINTMENT_PROXIMITY_DAYS) * 86400000;
    const maxMs = (daysToDeparture + APPOINTMENT_PROXIMITY_DAYS) * 86400000;
    const inWindow = upcomingApts.some((a) => {
      const delta = a.scheduledAt.getTime() - now.getTime();
      return delta >= minMs && delta <= maxMs;
    });
    appointmentOutsideWindow = !inWindow;
  }

  const country = student.countryId
    ? (await db.select().from(countriesTable).where(eq(countriesTable.id, student.countryId)))[0]
    : null;
  const cfSteps = allSteps.filter((s) => s.isCampusFranceStep);
  const missingCampusFrance =
    !!country?.requiresCampusFrance &&
    cfSteps.length > 0 &&
    cfSteps.some((s) => s.status === "not_started" || s.status === "blocked");

  const financialProofs = await db
    .select()
    .from(financialProofsTable)
    .where(eq(financialProofsTable.studentId, studentId));
  const refusalMotifCodes = computeRefusalMotifFlags({
    docs,
    missingCampusFrance,
    hasVisaRefusalHistory: student.hasVisaRefusalHistory,
    financialProofCount: financialProofs.length,
  });
  const refusalMotifFlags = refusalMotifFlagIds(refusalMotifCodes);

  const profilePct = profileCompletenessPct(student);
  const lowProfileCompleteness =
    hasStudentProgramProfile(student) && profilePct < PROFILE_COMPLETENESS_THRESHOLD;

  const signals: VisaSignals = {
    missingDocs,
    rejectedDocs,
    missingLettreAdmission: documentCategoryIsMissing(docs, "lettre_admission"),
    missingJustificatifFinancier: documentCategoryIsMissing(docs, "justificatif_financier"),
    overdueTasks: overdueTasks.length,
    delayedSteps,
    missingTlsAppointment,
    appointmentOutsideWindow,
    hasVisaRefusal: student.hasVisaRefusalHistory,
    lowProfileCompleteness,
    profilePct,
  };

  let score = 0;
  score += signals.missingDocs * 8;
  score += signals.rejectedDocs * 12;
  if (signals.missingLettreAdmission) score += 15;
  if (signals.missingJustificatifFinancier) score += 12;
  score += signals.overdueTasks * 10;
  score += signals.delayedSteps * 5;
  if (signals.missingTlsAppointment) score += 12;
  if (signals.appointmentOutsideWindow) score += 15;
  if (signals.hasVisaRefusal) score += 20;
  for (const code of refusalMotifCodes) score += MOTIF_SCORE[code];
  if (signals.lowProfileCompleteness) score += 10;
  score = Math.min(100, score);

  const level: "low" | "medium" | "high" = score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  const recommendations = buildRecommendations(signals, daysToIntake);
  for (const code of refusalMotifCodes) recommendations.push(MOTIF_REC[code]);

  const values = {
    studentId,
    score,
    level,
    missingDocuments: missingDocs,
    overdueTasks: overdueTasks.length,
    rejectedDocuments: rejectedDocs,
    missingCampusFrance,
    missingAppointments: missingTlsAppointment || appointmentOutsideWindow,
    hasVisaRefusal: student.hasVisaRefusalHistory,
    refusalMotifFlags,
    recommendations,
    calculatedAt: new Date(),
  };

  const [existing] = await db
    .select()
    .from(riskScoresTable)
    .where(eq(riskScoresTable.studentId, studentId));

  if (existing) {
    const [updated] = await db
      .update(riskScoresTable)
      .set(values)
      .where(eq(riskScoresTable.studentId, studentId))
      .returning();
    return updated;
  }

  const [created] = await db.insert(riskScoresTable).values(values).returning();
  return created;
}
