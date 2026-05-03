import { Router, type IRouter } from "express";
import {
  db,
  commentsTable,
  tasksTable,
  appointmentsTable,
  notificationsTable,
  studentsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  requireAuth,
  isStaff,
  requireStudentAccess,
  canAccessStudent,
} from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { sendMail } from "../lib/mailer";
import { validateBody } from "../middlewares/validate";
import {
  CreateCommentBody,
  CreateTaskBody,
  UpdateTaskBody,
  CreateAppointmentBody,
  UpdateAppointmentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// COMMENTS
function decorateComment(
  c: typeof commentsTable.$inferSelect,
  author: { firstName: string | null; lastName: string | null; role: string } | undefined,
) {
  const fullName = [author?.firstName, author?.lastName]
    .filter((p) => !!p)
    .join(" ")
    .trim();
  return {
    ...c,
    authorName: fullName || "Utilisateur",
    authorRole: author?.role ?? "student",
  };
}

router.get(
  "/students/:studentId/comments",
  requireAuth,
  requireStudentAccess("studentId", "read"),
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const rows = await db
      .select({
        comment: commentsTable,
        author: {
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          role: usersTable.role,
        },
      })
      .from(commentsTable)
      .leftJoin(usersTable, eq(usersTable.id, commentsTable.authorId))
      .where(eq(commentsTable.studentId, studentId))
      .orderBy(desc(commentsTable.createdAt));
    let mapped = rows.map((r) => decorateComment(r.comment, r.author ?? undefined));
    if (req.currentUser!.role === "student") {
      mapped = mapped.filter((c) => !c.isInternal);
    }
    res.json(mapped);
  },
);

router.post(
  "/students/:studentId/comments",
  requireAuth,
  requireStudentAccess("studentId", "read"),
  validateBody(CreateCommentBody),
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const { content, isInternal, isCorrectionRequest } = req.body ?? {};
    if (!content) {
      res.status(400).json({ error: "Content required" });
      return;
    }
    const internalFlag = isStaff(req.currentUser!) ? !!isInternal : false;
    const [created] = await db
      .insert(commentsTable)
      .values({
        studentId,
        authorId: req.currentUser!.id,
        content,
        isInternal: internalFlag,
        isCorrectionRequest: !!isCorrectionRequest,
      })
      .returning();
    const student = req.targetStudent!;
    if (student.userId && isStaff(req.currentUser!) && !internalFlag) {
      await db.insert(notificationsTable).values({
        userId: student.userId,
        studentId,
        title: isCorrectionRequest ? "Demande de correction" : "Nouveau commentaire",
        message: content.slice(0, 200),
        type: isCorrectionRequest ? "warning" : "info",
      });
    }
    await logAudit({
      userId: req.currentUser!.id,
      studentId,
      action: "comment.create",
      entityType: "comment",
      entityId: created.id,
    });
    res.status(201).json(decorateComment(created, req.currentUser!));
  },
);

router.delete(
  "/students/:studentId/comments/:commentId",
  requireAuth,
  requireStudentAccess("studentId", "read"),
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const id = Number(req.params.commentId);
    const [c] = await db
      .select()
      .from(commentsTable)
      .where(and(eq(commentsTable.id, id), eq(commentsTable.studentId, studentId)));
    if (!c) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    if (c.authorId !== req.currentUser!.id && !isStaff(req.currentUser!)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await db.delete(commentsTable).where(eq(commentsTable.id, id));
    res.status(204).send();
  },
);

// TASKS
router.get(
  "/students/:studentId/tasks",
  requireAuth,
  requireStudentAccess("studentId", "read"),
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    res.json(
      await db
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.studentId, studentId))
        .orderBy(desc(tasksTable.createdAt)),
    );
  },
);

router.post(
  "/students/:studentId/tasks",
  requireAuth,
  requireStudentAccess("studentId", "write"),
  validateBody(CreateTaskBody),
  async (req, res) => {
    if (!isStaff(req.currentUser!)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const studentId = Number(req.params.studentId);
    const { title, description, assignedToId, priority, dueDate } = req.body ?? {};
    const [created] = await db
      .insert(tasksTable)
      .values({
        studentId,
        title,
        description: description ?? null,
        assignedToId: assignedToId ?? null,
        createdById: req.currentUser!.id,
        priority: priority ?? "medium",
        dueDate: dueDate ? new Date(dueDate) : null,
      })
      .returning();
    if (assignedToId) {
      await db.insert(notificationsTable).values({
        userId: assignedToId,
        studentId,
        title: "Nouvelle tâche assignée",
        message: title,
        type: "info",
      });
      try {
        const [assignee] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, assignedToId));
        if (assignee?.email) {
          await sendMail({
            to: assignee.email,
            subject: `Nouvelle tâche: ${title}`,
            text: `Bonjour ${assignee.firstName ?? ""},\n\nUne nouvelle tâche vous a été assignée: ${title}${
              description ? "\n\n" + description : ""
            }${priority ? "\n\nPriorité: " + priority : ""}`,
            event: "task.assigned",
            meta: { studentId, taskId: created.id },
          });
        }
      } catch {
        /* best-effort */
      }
    }
    await logAudit({
      userId: req.currentUser!.id,
      studentId,
      action: "task.create",
      entityType: "task",
      entityId: created.id,
    });
    res.status(201).json(created);
  },
);

router.patch("/tasks/:taskId", requireAuth, validateBody(UpdateTaskBody), async (req, res) => {
  const id = Number(req.params.taskId);
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, task.studentId));
  if (!student || !canAccessStudent(req.currentUser!, student)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const isAssignee = task.assignedToId === req.currentUser!.id;
  if (!isStaff(req.currentUser!) && !isAssignee) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { title, description, status, priority, dueDate, assignedToId } = req.body ?? {};
  // Non-staff assignees can only update status
  const patch =
    isStaff(req.currentUser!)
      ? {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(status !== undefined && { status }),
          ...(priority !== undefined && { priority }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(assignedToId !== undefined && { assignedToId }),
          ...(status === "done" && { completedAt: new Date() }),
          updatedAt: new Date(),
        }
      : {
          ...(status !== undefined && { status }),
          ...(status === "done" && { completedAt: new Date() }),
          updatedAt: new Date(),
        };
  const [updated] = await db
    .update(tasksTable)
    .set(patch)
    .where(eq(tasksTable.id, id))
    .returning();
  res.json(updated);
});

router.get("/tasks/my", requireAuth, async (req, res) => {
  const status = req.query.status as string | undefined;
  let rows = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.assignedToId, req.currentUser!.id))
    .orderBy(asc(tasksTable.dueDate));
  if (status) rows = rows.filter((t) => t.status === status);
  res.json(rows);
});

// APPOINTMENTS
router.get(
  "/students/:studentId/appointments",
  requireAuth,
  requireStudentAccess("studentId", "read"),
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    res.json(
      await db
        .select()
        .from(appointmentsTable)
        .where(eq(appointmentsTable.studentId, studentId))
        .orderBy(asc(appointmentsTable.scheduledAt)),
    );
  },
);

router.post(
  "/students/:studentId/appointments",
  requireAuth,
  requireStudentAccess("studentId", "write"),
  validateBody(CreateAppointmentBody),
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const { type, title, scheduledAt, location, notes } = req.body ?? {};
    const [created] = await db
      .insert(appointmentsTable)
      .values({
        studentId,
        type: type ?? "other",
        title,
        scheduledAt: new Date(scheduledAt),
        location: location ?? null,
        notes: notes ?? null,
      })
      .returning();
    const student = req.targetStudent!;
    if (student.userId && student.userId !== req.currentUser!.id) {
      await db.insert(notificationsTable).values({
        userId: student.userId,
        studentId,
        title: "Nouveau rendez-vous",
        message: `${title} — ${new Date(scheduledAt).toLocaleString("fr-FR")}`,
        type: "info",
      });
    }
    await logAudit({
      userId: req.currentUser!.id,
      studentId,
      action: "appointment.create",
      entityType: "appointment",
      entityId: created.id,
    });
    res.status(201).json(created);
  },
);

router.patch("/appointments/:appointmentId", requireAuth, validateBody(UpdateAppointmentBody), async (req, res) => {
  const id = Number(req.params.appointmentId);
  const [apt] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, id));
  if (!apt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, apt.studentId));
  if (!student || !canAccessStudent(req.currentUser!, student) || !isStaff(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const body = req.body ?? {};
  const [updated] = await db
    .update(appointmentsTable)
    .set({
      ...body,
      ...(body.scheduledAt && { scheduledAt: new Date(body.scheduledAt) }),
      updatedAt: new Date(),
    })
    .where(eq(appointmentsTable.id, id))
    .returning();
  res.json(updated);
});

router.delete("/appointments/:appointmentId", requireAuth, async (req, res) => {
  const id = Number(req.params.appointmentId);
  const [apt] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, id));
  if (!apt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, apt.studentId));
  if (!student || !canAccessStudent(req.currentUser!, student) || !isStaff(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(appointmentsTable).where(eq(appointmentsTable.id, id));
  res.status(204).send();
});

// NOTIFICATIONS
router.get("/notifications", requireAuth, async (req, res) => {
  // Accept both `unreadOnly` (OpenAPI / generated client contract) and the
  // legacy `unread` alias so existing callers keep working.
  const unread =
    req.query.unreadOnly === "true" || req.query.unread === "true";
  let rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.currentUser!.id))
    .orderBy(desc(notificationsTable.createdAt));
  if (unread) rows = rows.filter((n) => !n.isRead);
  res.json(rows.slice(0, 100));
});

router.post("/notifications/:notificationId/read", requireAuth, async (req, res) => {
  const id = Number(req.params.notificationId);
  const [updated] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.currentUser!.id)),
    )
    .returning();
  res.json(updated);
});

router.post("/notifications/read-all", requireAuth, async (req, res) => {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, req.currentUser!.id));
  res.json({ success: true });
});

export default router;
