import { Router, type IRouter } from "express";
import {
  db,
  studentsTable,
  studentStepsTable,
  checklistItemsTable,
  workflowStepsTable,
  workflowTemplatesTable,
  countriesTable,
  schoolsTable,
  programsTable,
  riskScoresTable,
  notificationsTable,
  tasksTable,
  usersTable,
  type Student,
  type User,
} from "@workspace/db";
import { eq, and, asc, desc, or, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const advisorAlias = alias(usersTable, "advisor_user");
import {
  requireAuth,
  isStaff,
  isAdmin,
  canAccessStudent,
  requireStudentAccess,
  requireRole,
} from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { sendMail, staffStudentLink, studentSelfLink } from "../lib/mailer";
import { validateBody } from "../middlewares/validate";
import {
  CreateStudentBody,
  UpdateStudentBody,
  AssignStudentBody,
  UpdateStudentStepBody,
  UpdateChecklistItemBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const STEP_STATUSES = [
  "not_started",
  "in_progress",
  "submitted",
  "under_review",
  "validated",
  "rejected",
  "blocked",
] as const;
type StepStatus = (typeof STEP_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<StepStatus, StepStatus[]> = {
  not_started: ["in_progress", "blocked"],
  in_progress: ["submitted", "blocked", "not_started"],
  submitted: ["under_review", "validated", "rejected", "blocked", "in_progress"],
  under_review: ["validated", "rejected", "blocked", "in_progress"],
  validated: ["in_progress"],
  rejected: ["in_progress", "submitted", "blocked"],
  blocked: ["in_progress", "not_started"],
};

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

  const { STEPS } = await import("../lib/seed");
  const checklistByStepName = new Map(STEPS.map((s) => [s.name, s.checklist]));

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
    // Provision per-step checklist items from the seed template
    const items = checklistByStepName.get(step.name) ?? [];
    if (items.length > 0) {
      await db.insert(checklistItemsTable).values(
        items.map((it, idx) => ({
          workflowStepId: step.id,
          studentId,
          label: it.label,
          isRequired: it.isRequired,
          isChecked: false,
          order: idx,
        })),
      );
    }
  }
}

// LIST students (filtered by role)
router.get("/students", requireAuth, async (req, res) => {
  const u = req.currentUser!;
  const baseFilter =
    u.role === "student"
      ? eq(studentsTable.userId, u.id)
      : u.role === "advisor"
        ? eq(studentsTable.advisorId, u.id)
        : u.role === "reviewer"
          ? eq(studentsTable.reviewerId, u.id)
          : undefined;
  const query = db
    .select({
      id: studentsTable.id,
      userId: studentsTable.userId,
      firstName: studentsTable.firstName,
      lastName: studentsTable.lastName,
      email: studentsTable.email,
      nationalityCode: studentsTable.nationalityCode,
      countryId: studentsTable.countryId,
      schoolId: studentsTable.schoolId,
      programId: studentsTable.programId,
      advisorId: studentsTable.advisorId,
      reviewerId: studentsTable.reviewerId,
      status: studentsTable.status,
      completionScore: studentsTable.completionScore,
      intakeDate: studentsTable.intakeDate,
      hasVisaRefusalHistory: studentsTable.hasVisaRefusalHistory,
      lastActivityAt: studentsTable.lastActivityAt,
      createdAt: studentsTable.createdAt,
      updatedAt: studentsTable.updatedAt,
      countryName: countriesTable.name,
      schoolName: schoolsTable.name,
      programName: programsTable.name,
      advisorFirstName: advisorAlias.firstName,
      advisorLastName: advisorAlias.lastName,
      riskLevel: riskScoresTable.level,
      riskScore: riskScoresTable.score,
    })
    .from(studentsTable)
    .leftJoin(countriesTable, eq(studentsTable.countryId, countriesTable.id))
    .leftJoin(schoolsTable, eq(studentsTable.schoolId, schoolsTable.id))
    .leftJoin(programsTable, eq(studentsTable.programId, programsTable.id))
    .leftJoin(advisorAlias, eq(studentsTable.advisorId, advisorAlias.id))
    .leftJoin(riskScoresTable, eq(studentsTable.id, riskScoresTable.studentId))
    .orderBy(desc(studentsTable.updatedAt));
  let rows = baseFilter ? await query.where(baseFilter) : await query;
  // Optional filters
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const countryId = req.query.countryId ? Number(req.query.countryId) : undefined;
  const schoolId = req.query.schoolId ? Number(req.query.schoolId) : undefined;
  const advisorIdRaw =
    req.query.advisorId !== undefined ? Number(req.query.advisorId) : undefined;
  const riskLevel = req.query.riskLevel as string | undefined;
  if (status) rows = rows.filter((r) => r.status === status);
  if (countryId) rows = rows.filter((r) => r.countryId === countryId);
  if (schoolId) rows = rows.filter((r) => r.schoolId === schoolId);
  if (advisorIdRaw === 0) {
    rows = rows.filter((r) => r.advisorId == null);
  } else if (advisorIdRaw && !Number.isNaN(advisorIdRaw)) {
    rows = rows.filter((r) => r.advisorId === advisorIdRaw);
  }
  if (riskLevel) rows = rows.filter((r) => r.riskLevel === riskLevel);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        `${r.firstName} ${r.lastName} ${r.email}`.toLowerCase().includes(q),
    );
  }
  // Compute current step for each (cheap-ish join: use cached order)
  const ids = rows.map((r) => r.id);
  const steps = ids.length
    ? await db
        .select()
        .from(studentStepsTable)
        .where(inArray(studentStepsTable.studentId, ids))
    : [];
  const isStaffRole = ["advisor", "reviewer", "admin", "superadmin"].includes(u.role);
  const enriched = rows.map((r) => {
    const next = steps
      .filter((s) => s.studentId === r.id)
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .find((s) => s.status !== "validated");
    const advisorName =
      r.advisorFirstName || r.advisorLastName
        ? `${r.advisorFirstName ?? ""} ${r.advisorLastName ?? ""}`.trim()
        : null;
    // Strip risk fields for non-staff (students must not see their own risk score)
    const { riskLevel, riskScore, ...rest } = r;
    return {
      ...rest,
      ...(isStaffRole ? { riskLevel, riskScore } : {}),
      advisorName,
      currentStepName: next?.stepName ?? null,
    };
  });
  res.json(enriched);
});

// CREATE student
router.post("/students", requireAuth, validateBody(CreateStudentBody), async (req, res) => {
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

router.patch("/students/:studentId", requireAuth, validateBody(UpdateStudentBody), async (req, res) => {
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
  // Students cannot change their own assignment fields, status, or any
  // field that feeds into the financial-readiness submission gate. Both
  // monthlyMinimumEur (per-month minimum) and programEndDate (program
  // duration) are gate determinants in computeFinancialReadiness — letting
  // a student tamper with them would let them lower the required amount
  // and bypass the legal financial-threshold check.
  if (req.currentUser!.role === "student") {
    delete body.advisorId;
    delete body.reviewerId;
    delete body.status;
    delete body.monthlyMinimumEur;
    delete body.programEndDate;
    delete body.intakeDate;
    delete body.riskLevel;
    delete body.riskScore;
  }
  // Submission-gate override is an admin-only privileged action. Strip
  // these fields from the generic student PATCH for ALL non-admin
  // callers (students, advisors, reviewers) so the only way to flip
  // the gate is via POST /students/:id/submission-gate-override, which
  // is admin-gated and audit-logged. Without this strip, an advisor
  // with student-edit access could bypass the readiness check by
  // PATCHing submissionGateOverride: true alongside status: submitted.
  if (!isAdmin(req.currentUser!)) {
    delete body.submissionGateOverride;
    delete body.submissionGateOverrideReason;
  }
  const previousStatus = student.status;

  // ── Submission gate: block transition to "submitted" when financial proofs,
  // accommodation or CVEC are not validated. Admins can override via the
  // /students/:id/submission-gate-override endpoint.
  if (body.status === "submitted" && previousStatus !== "submitted") {
    const { computeFinancialReadiness } = await import("./finance");
    const readiness = await computeFinancialReadiness(id);
    if (readiness && !readiness.ready && !readiness.overrideActive) {
      res.status(409).json({
        error: "submission_blocked",
        message:
          "Le dossier ne peut pas être soumis : les garanties financières, le logement ou la CVEC sont incomplets.",
        blockingReasons: readiness.blockingReasons,
        readiness,
      });
      return;
    }
  }

  const [updated] = await db
    .update(studentsTable)
    .set({ ...body, updatedAt: new Date(), lastActivityAt: new Date() })
    .where(eq(studentsTable.id, id))
    .returning();

  // Visa decision notifications — fire when status transitions into a
  // visa_obtained or visa_refused state. Best-effort; never block.
  const isVisaDecision =
    body.status &&
    body.status !== previousStatus &&
    (body.status === "visa_obtained" || body.status === "visa_refused");
  if (isVisaDecision) {
    try {
      const recipientIds = new Set<number>();
      if (updated.userId) recipientIds.add(updated.userId);
      if (updated.advisorId) recipientIds.add(updated.advisorId);
      if (recipientIds.size > 0) {
        const recipients = await db
          .select()
          .from(usersTable)
          .where(inArray(usersTable.id, Array.from(recipientIds)));
        const obtained = body.status === "visa_obtained";
        const subject = obtained
          ? `Visa obtenu — ${updated.firstName} ${updated.lastName}`
          : `Visa refusé — ${updated.firstName} ${updated.lastName}`;
        for (const r of recipients) {
          if (!r.email) continue;
          const isStudent = r.id === updated.userId;
          const link = isStudent ? studentSelfLink() : staffStudentLink(id);
          const text = obtained
            ? `Bonjour ${r.firstName ?? ""},\n\n${
                isStudent
                  ? "Excellente nouvelle : votre visa étudiant a été obtenu."
                  : `Le visa de ${updated.firstName} ${updated.lastName} a été obtenu.`
              }\n\nConsulter le dossier : ${link}`
            : `Bonjour ${r.firstName ?? ""},\n\n${
                isStudent
                  ? "Votre demande de visa a été refusée. Votre conseiller vous accompagnera sur les prochaines étapes (recours, nouveau dépôt, etc.)."
                  : `Le visa de ${updated.firstName} ${updated.lastName} a été refusé. Un suivi est requis (recours / nouveau dépôt).`
              }\n\nConsulter le dossier : ${link}`;
          await sendMail({
            to: r.email,
            subject,
            text,
            event: obtained ? "visa.obtained" : "visa.refused",
            meta: { studentId: id },
          });
        }
      }
    } catch {
      /* best-effort */
    }
  }

  await logAudit({
    userId: req.currentUser!.id,
    studentId: id,
    action: "student.update",
    entityType: "student",
    entityId: id,
  });
  res.json(updated);
});

router.patch(
  "/students/:studentId/assign",
  requireAuth,
  requireRole("admin", "superadmin"),
  validateBody(AssignStudentBody),
  async (req, res) => {
    // Reassignment is an admin-only operation: it changes who owns the
    // dossier and therefore who can read/write it. Advisors and reviewers —
    // even those currently assigned to the student — cannot reassign.
    if (!isAdmin(req.currentUser!)) {
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
      try {
        const [advisor] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, advisorId));
        if (advisor?.email) {
          const link = staffStudentLink(id);
          await sendMail({
            to: advisor.email,
            subject: `Nouveau dossier assigné: ${updated.firstName} ${updated.lastName}`,
            text: `Bonjour ${advisor.firstName ?? ""},\n\nLe dossier de ${updated.firstName} ${updated.lastName} vous a été assigné.\n\nOuvrir le dossier : ${link}`,
            event: "student.assigned",
            meta: { studentId: id },
          });
        }
      } catch {
        /* best-effort */
      }
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
  requireStudentAccess("studentId", "read"),
  validateBody(UpdateStudentStepBody),
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const stepId = Number(req.params.stepId);
    const [existingStep] = await db
      .select()
      .from(studentStepsTable)
      .where(
        and(eq(studentStepsTable.id, stepId), eq(studentStepsTable.studentId, studentId)),
      );
    if (!existingStep) {
      res.status(404).json({ error: "Step not found for student" });
      return;
    }
    const { status, blockedReason, overrideJustification, notes } = req.body ?? {};

    // Students can only mark their own steps in_progress/submitted; staff broader access.
    if (
      req.currentUser!.role === "student" &&
      status &&
      !["in_progress", "submitted"].includes(status)
    ) {
      res.status(403).json({ error: "Students can only mark steps in_progress or submitted" });
      return;
    }

    if (status !== undefined) {
      if (!STEP_STATUSES.includes(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      const current = existingStep.status as StepStatus;
      const allowed = ALLOWED_TRANSITIONS[current] ?? [];
      const isOverride = isAdmin(req.currentUser!) && !allowed.includes(status);
      if (!allowed.includes(status) && !isOverride) {
        res.status(409).json({
          error: `Invalid transition ${current} → ${status}`,
        });
        return;
      }
      if (isOverride && !overrideJustification) {
        res.status(400).json({
          error: "overrideJustification is required for admin override transitions",
        });
        return;
      }
      // Dependency: cannot validate a step if a prior required step is unfinished.
      if (status === "validated") {
        const priorRequired = await db
          .select()
          .from(studentStepsTable)
          .where(eq(studentStepsTable.studentId, studentId));
        const blocking = priorRequired.find(
          (s) =>
            s.isRequired &&
            s.stepOrder < existingStep.stepOrder &&
            s.status !== "validated",
        );
        if (blocking && !isOverride) {
          res.status(409).json({
            error: `Cannot validate: previous required step "${blocking.stepName}" is not validated`,
          });
          return;
        }
      }
      if (status === "blocked" && !blockedReason) {
        res.status(400).json({ error: "blockedReason is required when status is blocked" });
        return;
      }
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
      .where(
        and(eq(studentStepsTable.id, stepId), eq(studentStepsTable.studentId, studentId)),
      )
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

    // Task automation on transitions
    if (status !== undefined && status !== existingStep.status) {
      const [studentRow] = await db
        .select()
        .from(studentsTable)
        .where(eq(studentsTable.id, studentId));
      try {
        if (status === "in_progress" && studentRow?.userId) {
          await db.insert(tasksTable).values({
            studentId,
            title: `Étape « ${existingStep.stepName} » en cours`,
            description: `Cette étape vient de démarrer. Pensez à téléverser les pièces requises et à compléter les actions associées.`,
            assignedToId: studentRow.userId,
            createdById: req.currentUser!.id,
            priority: "medium",
            status: "pending",
          });
        }
        if (status === "submitted" && studentRow?.advisorId) {
          await db.insert(tasksTable).values({
            studentId,
            title: `Vérifier l'étape « ${existingStep.stepName} »`,
            description: `L'étudiant a soumis cette étape — à examiner.`,
            assignedToId: studentRow.advisorId,
            createdById: req.currentUser!.id,
            priority: "high",
            status: "pending",
          });
        }
        if (status === "blocked") {
          const blockedAssignee = studentRow?.advisorId ?? null;
          if (blockedAssignee) {
            await db.insert(tasksTable).values({
              studentId,
              title: `Débloquer « ${existingStep.stepName} »`,
              description: blockedReason ?? "Étape bloquée — intervention requise.",
              assignedToId: blockedAssignee,
              createdById: req.currentUser!.id,
              priority: "critical",
              status: "pending",
            });
          }
        }
      } catch (taskErr) {
        req.log.warn({ err: taskErr }, "Task automation failed (non-fatal)");
      }
    }
    // Determine whether this update was an admin override (transition outside
    // the normal allow-list). The audit trail must capture that fact AND the
    // justification supplied by the admin so the override is reviewable.
    const previousStatus = existingStep.status;
    const wasOverride =
      status !== undefined &&
      status !== previousStatus &&
      isAdmin(req.currentUser!) &&
      !(ALLOWED_TRANSITIONS[previousStatus as StepStatus] ?? []).includes(status);

    await logAudit({
      userId: req.currentUser!.id,
      studentId,
      action: wasOverride ? "student_step.override" : "student_step.update",
      entityType: "student_step",
      entityId: stepId,
      details: JSON.stringify({
        status,
        previousStatus,
        ...(blockedReason !== undefined && { blockedReason }),
        ...(notes !== undefined && { notes }),
        ...(wasOverride && {
          override: true,
          overrideJustification: overrideJustification ?? null,
          overrideBy: req.currentUser!.id,
          overrideRole: req.currentUser!.role,
        }),
      }),
    });
    res.json(updated);
  },
);

// CHECKLIST
router.get(
  "/students/:studentId/steps/:stepId/checklist",
  requireAuth,
  requireStudentAccess("studentId", "read"),
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const stepId = Number(req.params.stepId);
    const [studentStep] = await db
      .select()
      .from(studentStepsTable)
      .where(
        and(eq(studentStepsTable.id, stepId), eq(studentStepsTable.studentId, studentId)),
      );
    if (!studentStep) {
      res.status(404).json({ error: "Step not found for student" });
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
  requireStudentAccess("studentId", "read"),
  validateBody(UpdateChecklistItemBody),
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const itemId = Number(req.params.itemId);
    const [existing] = await db
      .select()
      .from(checklistItemsTable)
      .where(
        and(
          eq(checklistItemsTable.id, itemId),
          eq(checklistItemsTable.studentId, studentId),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Checklist item not found for student" });
      return;
    }
    const { isChecked, label } = req.body ?? {};
    // Students may toggle isChecked but not relabel items.
    const isStudentCaller = req.currentUser!.role === "student";
    const [updated] = await db
      .update(checklistItemsTable)
      .set({
        ...(isChecked !== undefined && {
          isChecked,
          checkedAt: isChecked ? new Date() : null,
          checkedBy: isChecked ? req.currentUser!.id : null,
        }),
        ...(label !== undefined && !isStudentCaller && { label }),
      })
      .where(
        and(
          eq(checklistItemsTable.id, itemId),
          eq(checklistItemsTable.studentId, studentId),
        ),
      )
      .returning();
    res.json(updated);
  },
);

export default router;
