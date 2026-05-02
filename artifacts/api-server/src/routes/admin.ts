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
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
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
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  let rows = await db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit);
  if (studentId) rows = rows.filter((l) => l.studentId === studentId);
  if (userId) rows = rows.filter((l) => l.userId === userId);
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
  const [steps, docs, apts, unreadNotifs] = await Promise.all([
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
  ]);
  const currentStep = steps
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .find((s) => s.status !== "validated");
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
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.assignedToId, u.id));
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < new Date() && t.status !== "done",
  );
  res.json({
    studentCount: myStudents.length,
    activeStudents: myStudents.filter((s) => s.status === "active").length,
    blockedStudents: myStudents.filter((s) => s.status === "blocked").length,
    submittedStudents: myStudents.filter((s) => s.status === "submitted").length,
    visaObtained: myStudents.filter((s) => s.status === "visa_obtained").length,
    visaRefused: myStudents.filter((s) => s.status === "visa_refused").length,
    myTasks: tasks.length,
    overdueTasks: overdueTasks.length,
    students: myStudents.slice(0, 50),
  });
});

router.get("/dashboard/admin", requireAuth, async (req, res) => {
  if (!isAdmin(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [users, students, docs, recentLogs] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(studentsTable),
    db.select().from(documentsTable),
    db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(20),
  ]);
  res.json({
    userCount: users.length,
    studentCount: students.length,
    documentCount: docs.length,
    activeStudents: students.filter((s) => s.status === "active").length,
    blockedStudents: students.filter((s) => s.status === "blocked").length,
    submittedStudents: students.filter((s) => s.status === "submitted").length,
    visaObtained: students.filter((s) => s.status === "visa_obtained").length,
    visaRefused: students.filter((s) => s.status === "visa_refused").length,
    pendingDocuments: docs.filter((d) => d.status === "received" || d.status === "under_review")
      .length,
    rejectedDocuments: docs.filter((d) => d.status === "rejected").length,
    usersByRole: {
      student: users.filter((u) => u.role === "student").length,
      advisor: users.filter((u) => u.role === "advisor").length,
      reviewer: users.filter((u) => u.role === "reviewer").length,
      admin: users.filter((u) => u.role === "admin").length,
      superadmin: users.filter((u) => u.role === "superadmin").length,
    },
    recentActivity: recentLogs,
  });
});

router.get("/dashboard/portfolio", requireAuth, async (req, res) => {
  if (!isStaff(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const students = await db.select().from(studentsTable);
  const byStatus = students.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  const total = students.length;
  const submitted = students.filter((s) => s.status === "submitted").length;
  const obtained = students.filter((s) => s.status === "visa_obtained").length;
  const refused = students.filter((s) => s.status === "visa_refused").length;
  const successRate =
    obtained + refused > 0 ? Math.round((obtained / (obtained + refused)) * 100) : 0;
  res.json({
    total,
    byStatus,
    successRate,
    avgCompletion:
      students.length > 0
        ? Math.round(students.reduce((s, x) => s + x.completionScore, 0) / students.length)
        : 0,
  });
});

export default router;
