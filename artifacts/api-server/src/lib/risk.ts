import {
  db,
  studentsTable,
  documentsTable,
  tasksTable,
  appointmentsTable,
  studentStepsTable,
  countriesTable,
  riskScoresTable,
  type RiskScore,
} from "@workspace/db";
import { eq, and, lt, ne } from "drizzle-orm";

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

  const country = student.countryId
    ? (await db.select().from(countriesTable).where(eq(countriesTable.id, student.countryId)))[0]
    : null;

  const cfSteps = await db
    .select()
    .from(studentStepsTable)
    .where(
      and(
        eq(studentStepsTable.studentId, studentId),
        eq(studentStepsTable.isCampusFranceStep, true),
      ),
    );
  const missingCampusFrance =
    !!country?.requiresCampusFrance &&
    cfSteps.length > 0 &&
    cfSteps.some((s) => s.status === "not_started" || s.status === "blocked");

  const upcomingApts = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(eq(appointmentsTable.studentId, studentId), eq(appointmentsTable.status, "upcoming")),
    );
  const missingAppointments = upcomingApts.length === 0 && student.status === "active";

  const hasVisaRefusal = student.hasVisaRefusalHistory;

  let score = 0;
  score += missingDocs * 8;
  score += rejectedDocs * 12;
  score += overdueTasks.length * 10;
  if (missingCampusFrance) score += 25;
  if (missingAppointments) score += 8;
  if (hasVisaRefusal) score += 20;
  score = Math.min(100, score);

  const level: "low" | "medium" | "high" = score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  const recommendations: string[] = [];
  if (missingDocs > 0) recommendations.push(`Téléverser ${missingDocs} document(s) manquant(s)`);
  if (rejectedDocs > 0)
    recommendations.push(`Corriger ${rejectedDocs} document(s) rejeté(s)`);
  if (overdueTasks.length > 0)
    recommendations.push(`Compléter ${overdueTasks.length} tâche(s) en retard`);
  if (missingCampusFrance) recommendations.push("Finaliser les étapes Campus France obligatoires");
  if (missingAppointments) recommendations.push("Planifier les prochains rendez-vous");
  if (hasVisaRefusal)
    recommendations.push("Joindre une lettre explicative liée au refus précédent");
  if (recommendations.length === 0) recommendations.push("Dossier en bonne voie — continuer le suivi régulier");

  const values = {
    studentId,
    score,
    level,
    missingDocuments: missingDocs,
    overdueTasks: overdueTasks.length,
    rejectedDocuments: rejectedDocs,
    missingCampusFrance,
    missingAppointments,
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
