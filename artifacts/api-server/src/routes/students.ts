import { Router, type IRouter } from "express";
import {
  db,
  studentsTable,
  studentStepsTable,
  checklistItemsTable,
  workflowStepsTable,
  workflowTemplatesTable,
  countriesTable,
  notificationsTable,
  type Student,
  type User,
} from "@workspace/db";
import { eq, and, asc, desc, or } from "drizzle-orm";
import { requireAuth, isStaff, isAdmin } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

async function canAccessStudent(user: User, student: Student): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (user.role === "advisor" && student.advisorId === user.id) return true;
  if (user.role === "reviewer" && student.reviewerId === user.id) return true;
  if (user.role === "student" && student.userId === user.id) return true;
  return false;
}

async function provisionWorkflowForStudent(studentId: number, countryId: number | null) {
  // Find default template (or country-specific)
  let [tpl] = countryId
    ? await db
        .select()
        .from(workflowTemplatesTable)
        .where(eq(workflowTemplatesTable.countryId, countryId))
    : [];
  if (!tpl) {
    [tpl] = await db
      .select()
      .from(workflowTemplatesTable)
      .where(eq(workflowTemplatesTable.isDefault, true));
  }
  if (!tpl) return;

  const country = countryId
    ? (await db.select().from(countriesTable).where(eq(countriesTable.id, countryId)))[0]
    : null;
  const requiresCampusFrance = !!country?.requiresCampusFrance;

  const steps = await db
    .select()
    .from(workflowStepsTable)
    .where(eq(workflowStepsTable.workflowTemplateId, tpl.id))
    .orderBy(asc(workflowStepsTable.order));

  for (const step of steps) {
    // Skip Campus France steps for countries that don't require it
    if (step.isCampusFranceStep && !requiresCampusFrance) continue;
    await db.insert(studentStepsTable).values({
      studentId,
      workflowStepId: step.id,
      stepName: step.name,
      stepOrder: step.order,
      isCampusFranceStep: step.isCampusFranceStep,
      isRequired: step.isRequired,
      status: "not_started",
    });
  }
}

// LIST students (filtered by role)
router.get("/students", requireAuth, async (req, res) => {
  const u = req.currentUser!;
  let rows;
  if (u.role === "student") {
    rows = await db.select().from(studentsTable).where(eq(studentsTable.userId, u.id));
  } else if (u.role === "advisor") {
    rows = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.advisorId, u.id))
      .orderBy(desc(studentsTable.updatedAt));
  } else if (u.role === "reviewer") {
    rows = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.reviewerId, u.id))
      .orderBy(desc(studentsTable.updatedAt));
  } else {
    rows = await db.select().from(studentsTable).orderBy(desc(studentsTable.updatedAt));
  }
  // Optional filters
  const status = req.query.status as string | undefined;
  if (status) rows = rows.filter((r) => r.status === status);
  res.json(rows);
});

// CREATE student
router.post("/students", requireAuth, async (req, res) => {
  const u = req.currentUser!;
  if (!isStaff(u) && u.role !== "student") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const body = req.body ?? {};
  // Self-registration: students can create their own profile linked to their user
  const data = {
    ...body,
    userId: u.role === "student" ? u.id : body.userId ?? null,
    advisorId: body.advisorId ?? null,
    reviewerId: body.reviewerId ?? null,
  };
  const [created] = await db.insert(studentsTable).values(data).returning();
  await provisionWorkflowForStudent(created.id, created.countryId ?? null);
  await logAudit({
    userId: u.id,
    studentId: created.id,
    action: "student.create",
    entityType: "student",
    entityId: created.id,
  });
  res.status(201).json(created);
});

router.get("/students/:studentId", requireAuth, async (req, res) => {
  const id = Number(req.params.studentId);
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  if (!(await canAccessStudent(req.currentUser!, student))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(student);
});

router.patch("/students/:studentId", requireAuth, async (req, res) => {
  const id = Number(req.params.studentId);
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  if (!(await canAccessStudent(req.currentUser!, student))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const body = req.body ?? {};
  // Students cannot change their own assignment fields
  if (req.currentUser!.role === "student") {
    delete body.advisorId;
    delete body.reviewerId;
    delete body.status;
  }
  const [updated] = await db
    .update(studentsTable)
    .set({ ...body, updatedAt: new Date(), lastActivityAt: new Date() })
    .where(eq(studentsTable.id, id))
    .returning();
  await logAudit({
    userId: req.currentUser!.id,
    studentId: id,
    action: "student.update",
    entityType: "student",
    entityId: id,
  });
  res.json(updated);
});

router.post(
  "/students/:studentId/assign",
  requireAuth,
  async (req, res) => {
    if (!isStaff(req.currentUser!)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const id = Number(req.params.studentId);
    const { advisorId, reviewerId } = req.body ?? {};
    const [updated] = await db
      .update(studentsTable)
      .set({
        ...(advisorId !== undefined && { advisorId }),
        ...(reviewerId !== undefined && { reviewerId }),
        updatedAt: new Date(),
      })
      .where(eq(studentsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    // Notify assigned users
    if (advisorId) {
      await db.insert(notificationsTable).values({
        userId: advisorId,
        studentId: id,
        title: "Nouveau dossier assigné",
        message: `Vous avez été assigné(e) au dossier de ${updated.firstName} ${updated.lastName}.`,
        type: "info",
      });
    }
    await logAudit({
      userId: req.currentUser!.id,
      studentId: id,
      action: "student.assign",
      entityType: "student",
      entityId: id,
      details: JSON.stringify({ advisorId, reviewerId }),
    });
    res.json(updated);
  },
);

// STUDENT STEPS
router.get(
  "/students/:studentId/steps",
  requireAuth,
  async (req, res) => {
    const id = Number(req.params.studentId);
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    if (!(await canAccessStudent(req.currentUser!, student))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const steps = await db
      .select()
      .from(studentStepsTable)
      .where(eq(studentStepsTable.studentId, id))
      .orderBy(asc(studentStepsTable.stepOrder));
    res.json(steps);
  },
);

router.patch(
  "/students/:studentId/steps/:stepId",
  requireAuth,
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const stepId = Number(req.params.stepId);
    const [student] = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.id, studentId));
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    if (!(await canAccessStudent(req.currentUser!, student))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const { status, blockedReason, overrideJustification, notes } = req.body ?? {};
    // Students can only mark their own steps in_progress/submitted; staff can do anything
    if (
      req.currentUser!.role === "student" &&
      status &&
      !["in_progress", "submitted"].includes(status)
    ) {
      res.status(403).json({ error: "Students can only mark steps in_progress or submitted" });
      return;
    }
    const [updated] = await db
      .update(studentStepsTable)
      .set({
        ...(status !== undefined && { status }),
        ...(blockedReason !== undefined && { blockedReason }),
        ...(overrideJustification !== undefined && { overrideJustification }),
        ...(notes !== undefined && { notes }),
        ...(status === "validated" && { completedAt: new Date() }),
        updatedAt: new Date(),
      })
      .where(eq(studentStepsTable.id, stepId))
      .returning();
    // Update student completion score
    const allSteps = await db
      .select()
      .from(studentStepsTable)
      .where(eq(studentStepsTable.studentId, studentId));
    const validated = allSteps.filter((s) => s.status === "validated").length;
    const score = allSteps.length > 0 ? Math.round((validated / allSteps.length) * 100) : 0;
    await db
      .update(studentsTable)
      .set({ completionScore: score, lastActivityAt: new Date() })
      .where(eq(studentsTable.id, studentId));
    await logAudit({
      userId: req.currentUser!.id,
      studentId,
      action: "student_step.update",
      entityType: "student_step",
      entityId: stepId,
      details: JSON.stringify({ status }),
    });
    res.json(updated);
  },
);

// CHECKLIST
router.get(
  "/students/:studentId/steps/:stepId/checklist",
  requireAuth,
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const stepId = Number(req.params.stepId);
    const [studentStep] = await db
      .select()
      .from(studentStepsTable)
      .where(eq(studentStepsTable.id, stepId));
    if (!studentStep) {
      res.status(404).json({ error: "Step not found" });
      return;
    }
    const items = await db
      .select()
      .from(checklistItemsTable)
      .where(
        and(
          eq(checklistItemsTable.studentId, studentId),
          eq(checklistItemsTable.workflowStepId, studentStep.workflowStepId),
        ),
      )
      .orderBy(asc(checklistItemsTable.order));
    res.json(items);
  },
);

router.patch(
  "/students/:studentId/checklist-items/:itemId",
  requireAuth,
  async (req, res) => {
    const itemId = Number(req.params.itemId);
    const { isChecked, label } = req.body ?? {};
    const [updated] = await db
      .update(checklistItemsTable)
      .set({
        ...(isChecked !== undefined && {
          isChecked,
          checkedAt: isChecked ? new Date() : null,
          checkedBy: isChecked ? req.currentUser!.id : null,
        }),
        ...(label !== undefined && { label }),
      })
      .where(eq(checklistItemsTable.id, itemId))
      .returning();
    res.json(updated);
  },
);

export default router;
