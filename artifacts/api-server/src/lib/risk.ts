import {
  db,
  studentsTable,
  documentsTable,
  tasksTable,
  appointmentsTable,
  studentStepsTable,
  riskScoresTable,
  type RiskScore,
} from "@workspace/db";
import { eq, and, lt, ne } from "drizzle-orm";

// How close to the intake/departure date a step is considered late if it has
// not progressed past "not_started". Intake is the school start (rentrée);
// students are expected to depart ~30 days before intake.
const STEP_DELAY_THRESHOLD_DAYS = 60; // within 60 days of rentrée, not_started steps are "delayed"
const DEPARTURE_OFFSET_DAYS = 30; // students typically depart 30 days before intake
const APPOINTMENT_PROXIMITY_DAYS = 30; // appointments must be booked within 30 days of departure

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
  const admissionDoc = docs.find(
    (d) => d.category === "lettre_admission" || d.category === "lettre_admission_definitive",
  );
  const missingAdmissionLetter =
    !admissionDoc ||
    admissionDoc.status === "missing" ||
    admissionDoc.status === "rejected";

  // Step delays vs intake/rentrée timeline ----------------------------------
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
  let intakeOverdue = false;
  if (intakeDate) {
    if (daysToIntake !== null && daysToIntake < 0 && student.status === "active") {
      intakeOverdue = true;
    }
    if (daysToIntake !== null && daysToIntake <= STEP_DELAY_THRESHOLD_DAYS) {
      delayedSteps = allSteps.filter(
        (s) => s.isRequired && (s.status === "not_started" || s.status === "blocked"),
      ).length;
    }
  }

  const upcomingApts = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(eq(appointmentsTable.studentId, studentId), eq(appointmentsTable.status, "upcoming")),
    );
  const missingAppointments = upcomingApts.length === 0 && student.status === "active";

  let appointmentNotInProximityWindow = false;
  if (expectedDeparture && upcomingApts.length > 0 && daysToDeparture !== null && daysToDeparture > 0) {
    const minMs = (daysToDeparture - APPOINTMENT_PROXIMITY_DAYS) * 86400000;
    const maxMs = (daysToDeparture + APPOINTMENT_PROXIMITY_DAYS) * 86400000;
    const inWindow = upcomingApts.some((a) => {
      const delta = a.scheduledAt.getTime() - now.getTime();
      return delta >= minMs && delta <= maxMs;
    });
    appointmentNotInProximityWindow = !inWindow;
  }

  const hasVisaRefusal = student.hasVisaRefusalHistory;

  let score = 0;
  score += missingDocs * 8;
  score += rejectedDocs * 12;
  score += overdueTasks.length * 10;
  if (missingAdmissionLetter) score += 25;
  if (missingAppointments) score += 8;
  if (hasVisaRefusal) score += 20;
  score += delayedSteps * 5;
  if (intakeOverdue) score += 30;
  if (appointmentNotInProximityWindow) score += 15;
  score = Math.min(100, score);

  const level: "low" | "medium" | "high" = score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  const recommendations: string[] = [];
  if (missingDocs > 0) recommendations.push(`Téléverser ${missingDocs} document(s) manquant(s)`);
  if (rejectedDocs > 0)
    recommendations.push(`Corriger ${rejectedDocs} document(s) rejeté(s)`);
  if (overdueTasks.length > 0)
    recommendations.push(`Compléter ${overdueTasks.length} tâche(s) en retard`);
  if (missingAdmissionLetter)
    recommendations.push("Téléverser la lettre d'admission de l'école privée");
  if (missingAppointments) recommendations.push("Planifier les prochains rendez-vous");
  if (hasVisaRefusal)
    recommendations.push("Joindre une lettre explicative liée au refus précédent");
  if (delayedSteps > 0 && daysToIntake !== null) {
    recommendations.push(
      `Accélérer ${delayedSteps} étape(s) requise(s) — rentrée dans ${daysToIntake} jour(s)`,
    );
  }
  if (intakeOverdue) {
    recommendations.push("Date de rentrée dépassée — réviser le calendrier ou changer d'intake");
  }
  if (appointmentNotInProximityWindow) {
    recommendations.push(
      `Replanifier un rendez-vous dans la fenêtre de ${APPOINTMENT_PROXIMITY_DAYS} jours autour du départ`,
    );
  }
  if (recommendations.length === 0) recommendations.push("Dossier en bonne voie — continuer le suivi régulier");

  const values = {
    studentId,
    score,
    level,
    missingDocuments: missingDocs,
    overdueTasks: overdueTasks.length,
    rejectedDocuments: rejectedDocs,
    missingCampusFrance: false,
    missingAppointments: missingAppointments || appointmentNotInProximityWindow,
    hasVisaRefusal,
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
