import { Router, type IRouter } from "express";
import {
  db,
  auditLogsTable,
  studentsTable,
  documentsTable,
  tasksTable,
  appointmentsTable,
  notificationsTable,
  riskScoresTable,
  usersTable,
  commentsTable,
  studentStepsTable,
  countriesTable,
  schoolsTable,
} from "@workspace/db";
import { eq, and, asc, desc, sql, gte, lt, inArray } from "drizzle-orm";
import {
  GetAdvisorDashboardResponse,
  GetAdminDashboardResponse,
  GetPortfolioStatsResponse,
} from "@workspace/api-zod";
import { requireAuth, isAdmin, isStaff, requireStudentAccess } from "../middlewares/auth";
import { calculateRiskScore } from "../lib/risk";

const router: IRouter = Router();

// AUDIT LOGS
router.get("/audit-logs", requireAuth, async (req, res) => {
  if (!isAdmin(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const studentId = req.query.studentId ? Number(req.query.studentId) : undefined;
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  const action =
    typeof req.query.action === "string" && req.query.action
      ? String(req.query.action)
      : undefined;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const conds = [];
  if (studentId) conds.push(eq(auditLogsTable.studentId, studentId));
  if (userId) conds.push(eq(auditLogsTable.userId, userId));
  if (action) conds.push(eq(auditLogsTable.action, action));
  // Tenant scoping: non-superadmin admins only see audit rows for actors in
  // their own tenant. Superadmins keep the global view.
  const me = req.currentUser!;
  if (me.role !== "superadmin" && me.tenantId) {
    const tenantUserIds = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.tenantId, me.tenantId));
    const ids = tenantUserIds.map((u) => u.id);
    if (ids.length === 0) {
      res.json([]);
      return;
    }
    conds.push(inArray(auditLogsTable.userId, ids));
  }
  const whereExpr = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(whereExpr)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit)
    .offset(offset);
  res.json(rows);
});

// RISK SCORES — staff only (students must not see their own risk score)
router.get(
  "/students/:studentId/risk-score",
  requireAuth,
  requireStudentAccess("studentId", "read"),
  async (req, res) => {
    if (!isStaff(req.currentUser!)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const studentId = Number(req.params.studentId);
    let [score] = await db
      .select()
      .from(riskScoresTable)
      .where(eq(riskScoresTable.studentId, studentId));
    if (!score) {
      score = await calculateRiskScore(studentId);
    }
    res.json(score);
  },
);

router.post(
  "/students/:studentId/risk-score",
  requireAuth,
  requireStudentAccess("studentId", "write"),
  async (req, res) => {
    if (!isStaff(req.currentUser!)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const studentId = Number(req.params.studentId);
    const score = await calculateRiskScore(studentId);
    res.json(score);
  },
);

// DASHBOARDS
router.get("/dashboard/student", requireAuth, async (req, res) => {
  const u = req.currentUser!;
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.userId, u.id));
  if (!student) {
    res.json({ student: null });
    return;
  }
  // Fire the lazy reminder sweep before reading notifications so any
  // arrival / titre-renewal reminder due today is materialised in this
  // very response (best-effort, never block the dashboard).
  try {
    const { runReminderSweepForStudent } = await import("../lib/postArrival");
    await runReminderSweepForStudent(student.id);
  } catch {
    /* best-effort */
  }
  const { postArrivalStepsTable } = await import("@workspace/db");
  const [steps, docs, apts, unreadNotifs, comments, postArrivalSteps] = await Promise.all([
    db.select().from(studentStepsTable).where(eq(studentStepsTable.studentId, student.id)),
    db.select().from(documentsTable).where(eq(documentsTable.studentId, student.id)),
    db
      .select()
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.studentId, student.id),
          eq(appointmentsTable.status, "upcoming"),
        ),
      ),
    db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, u.id), eq(notificationsTable.isRead, false))),
    db
      .select({
        id: commentsTable.id,
        studentId: commentsTable.studentId,
        authorId: commentsTable.authorId,
        content: commentsTable.content,
        isInternal: commentsTable.isInternal,
        isCorrectionRequest: commentsTable.isCorrectionRequest,
        createdAt: commentsTable.createdAt,
        authorFirstName: usersTable.firstName,
        authorLastName: usersTable.lastName,
        authorRole: usersTable.role,
      })
      .from(commentsTable)
      .leftJoin(usersTable, eq(commentsTable.authorId, usersTable.id))
      .where(
        and(eq(commentsTable.studentId, student.id), eq(commentsTable.isInternal, false)),
      )
      .orderBy(desc(commentsTable.createdAt))
      .limit(10),
    db
      .select()
      .from(postArrivalStepsTable)
      .where(eq(postArrivalStepsTable.studentId, student.id))
      .orderBy(asc(postArrivalStepsTable.order)),
  ]);
  const currentStep = steps
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .find((s) => s.status !== "validated");
  const rejectedDocs = docs.filter((d) => d.status === "rejected");
  const blockedSteps = steps.filter((s) => s.status === "blocked");
  const { getVisaReadinessSummary } = await import("../lib/risk");
  const visaReadiness = await getVisaReadinessSummary(student.id);
  const nextActions: string[] = [...visaReadiness.recommendations];
  if (rejectedDocs.length > 0)
    nextActions.push(`Corriger ${rejectedDocs.length} document(s) rejeté(s)`);
  if (blockedSteps.length > 0)
    nextActions.push(`Débloquer ${blockedSteps.length} étape(s)`);
  if (currentStep) nextActions.push(`Avancer sur : ${currentStep.stepName}`);
  if (apts.length > 0) nextActions.push(`Préparer ${apts.length} rendez-vous à venir`);
  const recentComments = comments
    .filter((c) => c.authorRole !== "student")
    .map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      authorId: c.authorId,
      authorName:
        `${c.authorFirstName ?? ""} ${c.authorLastName ?? ""}`.trim() || "Conseiller",
      authorRole: c.authorRole ?? "advisor",
      isInternal: c.isInternal,
      isCorrectionRequest: c.isCorrectionRequest,
    }));
  res.json({
    student,
    completionScore: student.completionScore,
    totalSteps: steps.length,
    completedSteps: steps.filter((s) => s.status === "validated").length,
    currentStep,
    documentsCount: docs.length,
    pendingDocuments: docs.filter((d) => d.status === "missing" || d.status === "rejected").length,
    upcomingAppointments: apts,
    unreadNotifications: unreadNotifs.length,
    nextActions: nextActions.slice(0, 8),
    recentComments,
    postArrivalSteps,
  });
});

router.get("/dashboard/advisor", requireAuth, async (req, res) => {
  const u = req.currentUser!;
  if (!["advisor", "reviewer", "admin", "superadmin"].includes(u.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const myStudents =
    u.role === "advisor"
      ? await db.select().from(studentsTable).where(eq(studentsTable.advisorId, u.id))
      : u.role === "reviewer"
        ? await db.select().from(studentsTable).where(eq(studentsTable.reviewerId, u.id))
        : await db.select().from(studentsTable);

  const studentIds = myStudents.map((s) => s.id);
  const [tasks, risks, docs, apts] = await Promise.all([
    db.select().from(tasksTable).where(eq(tasksTable.assignedToId, u.id)),
    studentIds.length
      ? db.select().from(riskScoresTable).where(inArray(riskScoresTable.studentId, studentIds))
      : Promise.resolve([] as Array<typeof riskScoresTable.$inferSelect>),
    studentIds.length
      ? db.select().from(documentsTable).where(inArray(documentsTable.studentId, studentIds))
      : Promise.resolve([] as Array<typeof documentsTable.$inferSelect>),
    studentIds.length
      ? db
          .select()
          .from(appointmentsTable)
          .where(inArray(appointmentsTable.studentId, studentIds))
      : Promise.resolve([] as Array<typeof appointmentsTable.$inferSelect>),
  ]);
  const now = new Date();
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < now && t.status !== "done",
  );
  const highRiskStudentIds = new Set(
    risks.filter((r) => r.level === "high").map((r) => r.studentId),
  );
  const lateStudents = myStudents.filter(
    (s) => s.status === "blocked" || s.status === "active" && s.lastActivityAt && now.getTime() - new Date(s.lastActivityAt).getTime() > 14 * 86400000,
  ).length;
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);
  const todayAppointments = apts.filter(
    (a) => a.scheduledAt >= startOfDay && a.scheduledAt < endOfDay && a.status === "upcoming",
  ).length;
  const documentsAwaitingReview = docs.filter(
    (d) => d.status === "received" || d.status === "under_review",
  ).length;
  const urgentStudents = myStudents
    .filter((s) => highRiskStudentIds.has(s.id) || s.status === "blocked")
    .slice(0, 12)
    .map((s) => ({
      id: s.id,
      userId: s.userId ?? null,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      nationalityCode: s.nationalityCode ?? null,
      countryId: s.countryId ?? null,
      countryName: null,
      schoolId: s.schoolId ?? null,
      schoolName: null,
      programId: s.programId ?? null,
      programName: null,
      advisorId: s.advisorId ?? null,
      advisorName: null,
      reviewerId: s.reviewerId ?? null,
      status: s.status,
      completionScore: s.completionScore,
      riskLevel: risks.find((r) => r.studentId === s.id)?.level ?? null,
      riskScore: risks.find((r) => r.studentId === s.id)?.score ?? null,
      intakeDate: s.intakeDate ?? null,
      currentStepName: null,
      lastActivityAt: s.lastActivityAt ? new Date(s.lastActivityAt).toISOString() : null,
      createdAt: new Date(s.createdAt).toISOString(),
    }));
  // Scope recent activity: admins see global, advisors/reviewers see only their own actions
  const recentActivity = isAdmin(u)
    ? await db
        .select()
        .from(auditLogsTable)
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(20)
    : await db
        .select()
        .from(auditLogsTable)
        .where(eq(auditLogsTable.userId, u.id))
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(20);

  const payload = GetAdvisorDashboardResponse.parse({
    totalStudents: myStudents.length,
    blockedStudents: myStudents.filter((s) => s.status === "blocked").length,
    lateStudents,
    highRiskStudents: highRiskStudentIds.size,
    documentsAwaitingReview,
    todayAppointments,
    unresponsiveStudents: lateStudents,
    urgentStudents,
    recentActivity,
  });
  res.json(payload);
});

router.get("/dashboard/admin", requireAuth, async (req, res) => {
  if (!isAdmin(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [users, students, docs, recentLogs, countries, schools, risks, steps] =
    await Promise.all([
      db.select().from(usersTable),
      db.select().from(studentsTable),
      db.select().from(documentsTable),
      db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(20),
      db.select().from(countriesTable),
      db.select().from(schoolsTable),
      db.select().from(riskScoresTable),
      db.select().from(studentStepsTable),
    ]);
  const total = students.length || 1;
  const stat = (groups: Record<string, number>) =>
    Object.entries(groups)
      .map(([label, count]) => ({
        label,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

  const byCountry: Record<string, number> = {};
  const bySchool: Record<string, number> = {};
  const byAdvisor: Record<string, number> = {};
  for (const s of students) {
    const c = countries.find((x) => x.id === s.countryId)?.name ?? "—";
    byCountry[c] = (byCountry[c] ?? 0) + 1;
    const sc = schools.find((x) => x.id === s.schoolId)?.name ?? "—";
    bySchool[sc] = (bySchool[sc] ?? 0) + 1;
    const ad = users.find((u) => u.id === s.advisorId);
    const adName = ad ? `${ad.firstName} ${ad.lastName}` : "Non affecté";
    byAdvisor[adName] = (byAdvisor[adName] ?? 0) + 1;
  }
  const byStep: Record<string, number> = {};
  for (const s of students) {
    const next = steps
      .filter((x) => x.studentId === s.id)
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .find((x) => x.status !== "validated");
    const label = next?.stepName ?? "Terminé";
    byStep[label] = (byStep[label] ?? 0) + 1;
  }
  const byMonth: Record<string, number> = {};
  for (const s of students) {
    const m = s.intakeDate ? s.intakeDate.slice(0, 7) : null;
    if (!m) continue;
    byMonth[m] = (byMonth[m] ?? 0) + 1;
  }
  const byIntakeMonth = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => ({
      label,
      count,
      percentage: Math.round((count / total) * 100),
    }));

  const payload = GetAdminDashboardResponse.parse({
    totalStudents: students.length,
    totalAdvisors: users.filter((u) => u.role === "advisor" && u.isActive).length,
    totalReviewers: users.filter((u) => u.role === "reviewer" && u.isActive).length,
    studentsWithVisa: students.filter((s) => s.status === "visa_obtained").length,
    studentsInProgress: students.filter((s) =>
      ["active", "submitted"].includes(s.status),
    ).length,
    studentsBlocked: students.filter((s) => s.status === "blocked").length,
    visaRefused: students.filter((s) => s.status === "visa_refused").length,
    avgCompletionScore:
      students.length > 0
        ? Math.round(
            students.reduce((acc, s) => acc + s.completionScore, 0) / students.length,
          )
        : 0,
    highRiskCount: risks.filter((r) => r.level === "high").length,
    byCountry: stat(byCountry),
    bySchool: stat(bySchool),
    byStep: stat(byStep),
    byAdvisor: stat(byAdvisor),
    byIntakeMonth,
    recentAuditLogs: recentLogs,
  });
  res.json(payload);
});

router.get("/dashboard/portfolio", requireAuth, async (req, res) => {
  const u = req.currentUser!;
  if (!isStaff(u)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const studentsAll = await db.select().from(studentsTable);
  const students = isAdmin(u)
    ? studentsAll
    : u.role === "advisor"
      ? studentsAll.filter((s) => s.advisorId === u.id)
      : u.role === "reviewer"
        ? studentsAll.filter((s) => s.reviewerId === u.id)
        : studentsAll;
  const ids = students.map((s) => s.id);
  const [countries, schools, risks] = await Promise.all([
    db.select().from(countriesTable),
    db.select().from(schoolsTable),
    ids.length
      ? db.select().from(riskScoresTable).where(sql`${riskScoresTable.studentId} = ANY(${ids})`)
      : Promise.resolve([] as Array<typeof riskScoresTable.$inferSelect>),
  ]);
  const total = students.length || 1;
  const tally = (groups: Record<string, number>) =>
    Object.entries(groups)
      .map(([label, count]) => ({
        label,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

  const byStatus: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  const bySchool: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  for (const s of students) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    const c = countries.find((x) => x.id === s.countryId)?.name ?? "—";
    byCountry[c] = (byCountry[c] ?? 0) + 1;
    const sc = schools.find((x) => x.id === s.schoolId)?.name ?? "—";
    bySchool[sc] = (bySchool[sc] ?? 0) + 1;
    const month = s.intakeDate ? s.intakeDate.slice(0, 7) : "—";
    byMonth[month] = (byMonth[month] ?? 0) + 1;
  }
  const byRiskLevel: Record<string, number> = { low: 0, medium: 0, high: 0 };
  for (const r of risks) {
    byRiskLevel[r.level] = (byRiskLevel[r.level] ?? 0) + 1;
  }
  const payload = GetPortfolioStatsResponse.parse({
    byStatus: tally(byStatus),
    byRiskLevel: tally(byRiskLevel),
    byCountry: tally(byCountry).slice(0, 10),
    bySchool: tally(bySchool).slice(0, 10),
    byIntakeMonth: Object.entries(byMonth)
      .filter(([k]) => k !== "—")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count]) => ({
        label,
        count,
        percentage: Math.round((count / total) * 100),
      })),
  });
  res.json(payload);
});

export default router;
