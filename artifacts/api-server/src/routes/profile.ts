import { Router, type IRouter } from "express";
import {
  db,
  studentsTable,
  studentCivilStatusTable,
  priorSchoolingEntriesTable,
  languageTestsTable,
  diplomaEquivalencesTable,
  eefWishesTable,
  schoolsTable,
  programsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, asc, like, sql } from "drizzle-orm";
import { requireAuth, canAccessStudent, isStaff } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import { logAudit } from "../lib/audit";
import {
  UpsertStudentCivilStatusBody,
  CreatePriorSchoolingEntryBody,
  UpdatePriorSchoolingEntryBody,
  CreateLanguageTestBody,
  UpdateLanguageTestBody,
  CreateDiplomaEquivalenceBody,
  UpdateDiplomaEquivalenceBody,
  CreateEefWishBody,
  UpdateEefWishBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const MAX_EEF_WISHES = 7;
const EXPIRY_WARNING_DAYS = 90;

function parseIdParam(name: string, req: any, res: any): number | null {
  const raw = req.params[name];
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    res.status(400).json({ error: `Invalid ${name}` });
    return null;
  }
  return n;
}

async function loadStudentOr403(req: any, res: any) {
  const id = parseIdParam("studentId", req, res);
  if (id === null) return null;
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, id));
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return null;
  }
  if (!(await canAccessStudent(req.currentUser!, student))) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return student;
}

// ─── CIVIL STATUS (1:1) ─────────────────────────────────────────────────────
router.get("/students/:studentId/civil-status", requireAuth, async (req, res) => {
  const student = await loadStudentOr403(req, res);
  if (!student) return;
  const [row] = await db
    .select()
    .from(studentCivilStatusTable)
    .where(eq(studentCivilStatusTable.studentId, student.id));
  res.json(row ?? null);
});

router.put(
  "/students/:studentId/civil-status",
  requireAuth,
  validateBody(UpsertStudentCivilStatusBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const body = req.body ?? {};
    const [existing] = await db
      .select()
      .from(studentCivilStatusTable)
      .where(eq(studentCivilStatusTable.studentId, student.id));
    let saved;
    if (existing) {
      [saved] = await db
        .update(studentCivilStatusTable)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(studentCivilStatusTable.id, existing.id))
        .returning();
    } else {
      [saved] = await db
        .insert(studentCivilStatusTable)
        .values({ ...body, studentId: student.id })
        .returning();
    }
    await logAudit({
      userId: req.currentUser!.id,
      studentId: student.id,
      action: "civil_status.upsert",
      entityType: "student_civil_status",
      entityId: saved.id,
    });
    res.json(saved);
  },
);

// ─── PRIOR SCHOOLING ────────────────────────────────────────────────────────
router.get("/students/:studentId/prior-schooling", requireAuth, async (req, res) => {
  const student = await loadStudentOr403(req, res);
  if (!student) return;
  await ensureAdmissionWish(student);
  const rows = await db
    .select()
    .from(priorSchoolingEntriesTable)
    .where(eq(priorSchoolingEntriesTable.studentId, student.id))
    .orderBy(asc(priorSchoolingEntriesTable.startYear));
  res.json(rows);
});

router.post(
  "/students/:studentId/prior-schooling",
  requireAuth,
  validateBody(CreatePriorSchoolingEntryBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const [created] = await db
      .insert(priorSchoolingEntriesTable)
      .values({ ...req.body, studentId: student.id })
      .returning();
    await logAudit({
      userId: req.currentUser!.id,
      studentId: student.id,
      action: "prior_schooling.create",
      entityType: "prior_schooling_entry",
      entityId: created.id,
    });
    res.status(201).json(created);
  },
);

router.patch(
  "/students/:studentId/prior-schooling/:entryId",
  requireAuth,
  validateBody(UpdatePriorSchoolingEntryBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const entryId = Number(req.params.entryId);
    const [updated] = await db
      .update(priorSchoolingEntriesTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(
        and(
          eq(priorSchoolingEntriesTable.id, entryId),
          eq(priorSchoolingEntriesTable.studentId, student.id),
        ),
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json(updated);
  },
);

router.delete(
  "/students/:studentId/prior-schooling/:entryId",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const entryId = Number(req.params.entryId);
    const [deleted] = await db
      .delete(priorSchoolingEntriesTable)
      .where(
        and(
          eq(priorSchoolingEntriesTable.id, entryId),
          eq(priorSchoolingEntriesTable.studentId, student.id),
        ),
      )
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.status(204).end();
  },
);

// ─── LANGUAGE TESTS ─────────────────────────────────────────────────────────
async function ensureExpiryNotifications(studentId: number) {
  // Single-flight per student via Postgres advisory xact lock — prevents
  // race-condition duplicate notifications when multiple requests arrive
  // concurrently for the same student.
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${studentId})`);
    const tests = await tx
      .select()
      .from(languageTestsTable)
      .where(eq(languageTestsTable.studentId, studentId));
    if (tests.length === 0) return;
    const [student] = await tx
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.id, studentId));
    if (!student) return;
    const recipients = new Set<number>();
    if (student.userId) recipients.add(student.userId);
    if (student.advisorId) recipients.add(student.advisorId);
    if (recipients.size === 0) return;
    const now = new Date();
    const cutoff = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86400 * 1000);
    for (const test of tests) {
      if (!test.expiryDate) continue;
      const exp = new Date(test.expiryDate);
      if (Number.isNaN(exp.getTime())) continue;
      if (exp <= now || exp > cutoff) continue;
      const marker = `[lang_test:${test.id}]`;
      for (const userId of recipients) {
        const existing = await tx
          .select()
          .from(notificationsTable)
          .where(
            and(
              eq(notificationsTable.userId, userId),
              eq(notificationsTable.studentId, studentId),
              like(notificationsTable.message, `%${marker}%`),
            ),
          );
        if (existing.length > 0) continue;
        await tx.insert(notificationsTable).values({
          userId,
          studentId,
          title: `Test ${test.testType} expire bientôt`,
          message: `Le test ${test.testType} expire le ${test.expiryDate}. Pensez à le renouveler avant le dépôt du dossier. ${marker}`,
          type: "warning",
        });
      }
    }
  });
}

router.get("/students/:studentId/language-tests", requireAuth, async (req, res) => {
  const student = await loadStudentOr403(req, res);
  if (!student) return;
  await ensureExpiryNotifications(student.id).catch(() => {});
  const rows = await db
    .select()
    .from(languageTestsTable)
    .where(eq(languageTestsTable.studentId, student.id))
    .orderBy(asc(languageTestsTable.testDate));
  res.json(rows);
});

router.post(
  "/students/:studentId/language-tests",
  requireAuth,
  validateBody(CreateLanguageTestBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const [created] = await db
      .insert(languageTestsTable)
      .values({ ...req.body, studentId: student.id })
      .returning();
    await logAudit({
      userId: req.currentUser!.id,
      studentId: student.id,
      action: "language_test.create",
      entityType: "language_test",
      entityId: created.id,
    });
    await ensureExpiryNotifications(student.id).catch(() => {});
    res.status(201).json(created);
  },
);

router.patch(
  "/students/:studentId/language-tests/:testId",
  requireAuth,
  validateBody(UpdateLanguageTestBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const testId = Number(req.params.testId);
    const [updated] = await db
      .update(languageTestsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(
        and(
          eq(languageTestsTable.id, testId),
          eq(languageTestsTable.studentId, student.id),
        ),
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Test not found" });
      return;
    }
    await ensureExpiryNotifications(student.id).catch(() => {});
    res.json(updated);
  },
);

router.delete(
  "/students/:studentId/language-tests/:testId",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const testId = Number(req.params.testId);
    const [deleted] = await db
      .delete(languageTestsTable)
      .where(
        and(
          eq(languageTestsTable.id, testId),
          eq(languageTestsTable.studentId, student.id),
        ),
      )
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Test not found" });
      return;
    }
    res.status(204).end();
  },
);

// ─── DIPLOMA EQUIVALENCES ───────────────────────────────────────────────────
router.get(
  "/students/:studentId/diploma-equivalences",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const rows = await db
      .select()
      .from(diplomaEquivalencesTable)
      .where(eq(diplomaEquivalencesTable.studentId, student.id))
      .orderBy(asc(diplomaEquivalencesTable.id));
    res.json(rows);
  },
);

router.post(
  "/students/:studentId/diploma-equivalences",
  requireAuth,
  validateBody(CreateDiplomaEquivalenceBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const [created] = await db
      .insert(diplomaEquivalencesTable)
      .values({ ...req.body, studentId: student.id })
      .returning();
    await logAudit({
      userId: req.currentUser!.id,
      studentId: student.id,
      action: "diploma_equivalence.create",
      entityType: "diploma_equivalence",
      entityId: created.id,
    });
    res.status(201).json(created);
  },
);

router.patch(
  "/students/:studentId/diploma-equivalences/:equivId",
  requireAuth,
  validateBody(UpdateDiplomaEquivalenceBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const equivId = Number(req.params.equivId);
    const [updated] = await db
      .update(diplomaEquivalencesTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(
        and(
          eq(diplomaEquivalencesTable.id, equivId),
          eq(diplomaEquivalencesTable.studentId, student.id),
        ),
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json(updated);
  },
);

router.delete(
  "/students/:studentId/diploma-equivalences/:equivId",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const equivId = Number(req.params.equivId);
    const [deleted] = await db
      .delete(diplomaEquivalencesTable)
      .where(
        and(
          eq(diplomaEquivalencesTable.id, equivId),
          eq(diplomaEquivalencesTable.studentId, student.id),
        ),
      )
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.status(204).end();
  },
);


async function ensureAdmissionWish(student: { id: number; schoolId: number | null; programId: number | null }) {
  const existing = await db
    .select({ id: eefWishesTable.id })
    .from(eefWishesTable)
    .where(eq(eefWishesTable.studentId, student.id))
    .limit(1);
  if (existing.length > 0) return;
  if (!student.schoolId && !student.programId) return;
  await db.insert(eefWishesTable).values({
    studentId: student.id,
    wishOrder: 1,
    schoolId: student.schoolId,
    programId: student.programId,
    status: "accepted",
  });
}

// ─── EEF WISHES ─────────────────────────────────────────────────────────────
router.get("/students/:studentId/eef-wishes", requireAuth, async (req, res) => {
  const student = await loadStudentOr403(req, res);
  if (!student) return;
  const rows = await db
    .select({
      id: eefWishesTable.id,
      studentId: eefWishesTable.studentId,
      wishOrder: eefWishesTable.wishOrder,
      schoolId: eefWishesTable.schoolId,
      programId: eefWishesTable.programId,
      schoolNameFreeText: eefWishesTable.schoolNameFreeText,
      programNameFreeText: eefWishesTable.programNameFreeText,
      motivationText: eefWishesTable.motivationText,
      status: eefWishesTable.status,
      createdAt: eefWishesTable.createdAt,
      updatedAt: eefWishesTable.updatedAt,
      schoolName: schoolsTable.name,
      schoolCity: schoolsTable.city,
      programName: programsTable.name,
      programLevel: programsTable.level,
    })
    .from(eefWishesTable)
    .leftJoin(schoolsTable, eq(eefWishesTable.schoolId, schoolsTable.id))
    .leftJoin(programsTable, eq(eefWishesTable.programId, programsTable.id))
    .where(eq(eefWishesTable.studentId, student.id))
    .orderBy(asc(eefWishesTable.wishOrder));
  res.json(rows);
});

router.post(
  "/students/:studentId/eef-wishes",
  requireAuth,
  validateBody(CreateEefWishBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const body = req.body ?? {};
    if (
      typeof body.wishOrder !== "number" ||
      body.wishOrder < 1 ||
      body.wishOrder > MAX_EEF_WISHES
    ) {
      res.status(400).json({
        error: `wishOrder must be an integer between 1 and ${MAX_EEF_WISHES}`,
      });
      return;
    }
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eefWishesTable)
      .where(eq(eefWishesTable.studentId, student.id));
    if (count >= MAX_EEF_WISHES) {
      res.status(409).json({
        error: `Maximum ${MAX_EEF_WISHES} wishes reached`,
      });
      return;
    }
    try {
      const [created] = await db
        .insert(eefWishesTable)
        .values({ ...body, studentId: student.id })
        .returning();
      await logAudit({
        userId: req.currentUser!.id,
        studentId: student.id,
        action: "eef_wish.create",
        entityType: "eef_wish",
        entityId: created.id,
      });
      res.status(201).json(created);
    } catch (err: any) {
      if (err?.code === "23505") {
        res
          .status(409)
          .json({ error: `Wish order ${body.wishOrder} already used for this student` });
        return;
      }
      throw err;
    }
  },
);

router.patch(
  "/students/:studentId/eef-wishes/:wishId",
  requireAuth,
  validateBody(UpdateEefWishBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const wishId = Number(req.params.wishId);
    const body = req.body ?? {};
    if (
      body.wishOrder !== undefined &&
      (typeof body.wishOrder !== "number" ||
        body.wishOrder < 1 ||
        body.wishOrder > MAX_EEF_WISHES)
    ) {
      res
        .status(400)
        .json({ error: `wishOrder must be between 1 and ${MAX_EEF_WISHES}` });
      return;
    }
    try {
      const [updated] = await db
        .update(eefWishesTable)
        .set({ ...body, updatedAt: new Date() })
        .where(
          and(
            eq(eefWishesTable.id, wishId),
            eq(eefWishesTable.studentId, student.id),
          ),
        )
        .returning();
      if (!updated) {
        res.status(404).json({ error: "Wish not found" });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      if (err?.code === "23505") {
        res.status(409).json({ error: "Wish order already used for this student" });
        return;
      }
      throw err;
    }
  },
);

router.delete(
  "/students/:studentId/eef-wishes/:wishId",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const wishId = Number(req.params.wishId);
    const [deleted] = await db
      .delete(eefWishesTable)
      .where(
        and(
          eq(eefWishesTable.id, wishId),
          eq(eefWishesTable.studentId, student.id),
        ),
      )
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Wish not found" });
      return;
    }
    res.status(204).end();
  },
);

// ─── PROFILE-DEPTH SUMMARY ──────────────────────────────────────────────────
router.get("/students/:studentId/profile-depth", requireAuth, async (req, res) => {
  const student = await loadStudentOr403(req, res);
  if (!student) return;
  await ensureExpiryNotifications(student.id).catch(() => {});

  const [civilStatus] = await db
    .select()
    .from(studentCivilStatusTable)
    .where(eq(studentCivilStatusTable.studentId, student.id));
  const priorSchooling = await db
    .select()
    .from(priorSchoolingEntriesTable)
    .where(eq(priorSchoolingEntriesTable.studentId, student.id))
    .orderBy(asc(priorSchoolingEntriesTable.startYear));
  const languageTests = await db
    .select()
    .from(languageTestsTable)
    .where(eq(languageTestsTable.studentId, student.id))
    .orderBy(asc(languageTestsTable.testDate));
  const diplomaEquivalences = await db
    .select()
    .from(diplomaEquivalencesTable)
    .where(eq(diplomaEquivalencesTable.studentId, student.id));
  const eefWishes = await db
    .select()
    .from(eefWishesTable)
    .where(eq(eefWishesTable.studentId, student.id))
    .orderBy(asc(eefWishesTable.wishOrder));

  // Profile completeness — 6 buckets, each contributes ~16.67%
  const buckets = [
    !!(student.firstName && student.lastName && student.email && student.dateOfBirth),
    !!(
      civilStatus &&
      civilStatus.maritalStatus &&
      civilStatus.fatherFirstName &&
      civilStatus.motherFirstName
    ),
    priorSchooling.length >= 1,
    languageTests.length >= 1,
    diplomaEquivalences.length >= 1,
    !!(student.schoolId && student.programId),
  ];
  const filled = buckets.filter(Boolean).length;
  const profileCompletenessScore = Math.round((filled / buckets.length) * 100);

  // Expiry warnings (<=90 days, not yet expired)
  const now = Date.now();
  const cutoff = now + EXPIRY_WARNING_DAYS * 86400 * 1000;
  const expiringTests = languageTests
    .filter((t) => {
      if (!t.expiryDate) return false;
      const ts = new Date(t.expiryDate).getTime();
      return !Number.isNaN(ts) && ts > now && ts <= cutoff;
    })
    .map((t) => ({
      id: t.id,
      testType: t.testType,
      expiryDate: t.expiryDate,
      daysUntilExpiry: Math.ceil(
        (new Date(t.expiryDate!).getTime() - now) / (86400 * 1000),
      ),
    }));

  res.json({
    civilStatus: civilStatus ?? null,
    priorSchooling,
    languageTests,
    diplomaEquivalences,
    eefWishes,
    profileCompletenessScore,
    expiringLanguageTests: expiringTests,
  });
});

export default router;
