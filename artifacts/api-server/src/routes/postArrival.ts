import { Router, type IRouter } from "express";
import { db, postArrivalStepsTable, studentsTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { requireAuth, isStaff, canAccessStudent } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { provisionPostArrivalSteps } from "../lib/postArrival";

const router: IRouter = Router();

const STATUSES = [
  "not_started",
  "in_progress",
  "submitted",
  "under_review",
  "validated",
  "rejected",
  "blocked",
] as const;

router.get(
  "/students/:studentId/post-arrival-steps",
  requireAuth,
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(studentId)) {
      res.status(400).json({ error: "Invalid studentId" });
      return;
    }
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
    const rows = await db
      .select()
      .from(postArrivalStepsTable)
      .where(eq(postArrivalStepsTable.studentId, studentId))
      .orderBy(asc(postArrivalStepsTable.order));
    res.json(rows);
  },
);

// Idempotent (re)generation — safe to call from staff UI or to repair a
// dossier whose visaType / arrivalDate changed after the visa decision.
router.post(
  "/students/:studentId/post-arrival-steps/regenerate",
  requireAuth,
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(studentId)) {
      res.status(400).json({ error: "Invalid studentId" });
      return;
    }
    const [student] = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.id, studentId));
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    if (!isStaff(req.currentUser!) || !(await canAccessStudent(req.currentUser!, student))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const added = await provisionPostArrivalSteps(studentId, {
      visaType: student.visaType,
      arrivalDate: student.arrivalDate,
    });
    await logAudit({
      userId: req.currentUser!.id,
      studentId,
      action: "post_arrival.regenerate",
      entityType: "post_arrival_step",
      entityId: studentId,
      details: JSON.stringify({ added }),
    });
    res.json({ studentId, added });
  },
);

router.patch(
  "/students/:studentId/post-arrival-steps/:stepId",
  requireAuth,
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const stepId = Number(req.params.stepId);
    if (!Number.isInteger(studentId) || !Number.isInteger(stepId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
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
    const [existing] = await db
      .select()
      .from(postArrivalStepsTable)
      .where(
        and(
          eq(postArrivalStepsTable.id, stepId),
          eq(postArrivalStepsTable.studentId, studentId),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Step not found" });
      return;
    }
    const body = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.status === "string") {
      if (!STATUSES.includes(body.status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      patch.status = body.status;
      if (body.status === "validated") patch.completedAt = new Date();
    }
    if (typeof body.notes === "string" || body.notes === null) patch.notes = body.notes ?? null;
    if (typeof body.dueDate === "string" || body.dueDate === null) patch.dueDate = body.dueDate ?? null;
    const [updated] = await db
      .update(postArrivalStepsTable)
      .set(patch)
      .where(eq(postArrivalStepsTable.id, stepId))
      .returning();
    await logAudit({
      userId: req.currentUser!.id,
      studentId,
      action: "post_arrival.update",
      entityType: "post_arrival_step",
      entityId: stepId,
      details: JSON.stringify({ status: updated.status, code: updated.code }),
    });
    res.json(updated);
  },
);

export default router;
