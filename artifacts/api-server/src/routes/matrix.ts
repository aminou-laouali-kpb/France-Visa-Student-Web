import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  documentMatrixEntriesTable,
  intakeCalendarEntriesTable,
  studentsTable,
  studentStepsTable,
  workflowStepsTable,
  workflowTemplatesTable,
  checklistItemsTable,
  countriesTable,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import {
  requireAuth,
  isAdmin,
  isStaff,
  canAccessStudent,
} from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import { logAudit } from "../lib/audit";
import {
  CreateDocumentMatrixEntryBody,
  UpdateDocumentMatrixEntryBody,
  CreateIntakeCalendarEntryBody,
  UpdateIntakeCalendarEntryBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── REFERENCE DATA ──────────────────────────────────────────────────────
// Document categories the matrix editor can pick from. These mirror the
// categories that workflow steps' requiredDocumentCategories already use,
// plus a few consulate-only categories that admins can add per nationality.
export const MATRIX_DOCUMENT_CATEGORIES: { value: string; label: string }[] = [
  { value: "passeport", label: "Passeport" },
  { value: "extrait_naissance", label: "Extrait d'acte de naissance" },
  { value: "photo_identite", label: "Photo d'identité" },
  { value: "diplome", label: "Diplômes" },
  { value: "releve_notes", label: "Relevés de notes" },
  { value: "test_langue", label: "Test de langue (DELF/TCF)" },
  { value: "attestation_campus_france", label: "Attestation Campus France" },
  { value: "lettre_admission", label: "Lettre d'admission" },
  { value: "lettre_motivation", label: "Lettre de motivation" },
  { value: "cv", label: "CV" },
  { value: "justificatif_financier", label: "Justificatif financier" },
  { value: "justificatif_hebergement", label: "Justificatif d'hébergement" },
  { value: "assurance", label: "Assurance santé" },
  { value: "casier_judiciaire", label: "Casier judiciaire" },
  { value: "certificat_medical", label: "Certificat médical" },
  { value: "billet_avion", label: "Billet d'avion" },
  { value: "autre", label: "Autre" },
];

export const MATRIX_PROGRAM_LEVELS = [
  { value: "licence", label: "Licence" },
  { value: "bachelor", label: "Bachelor" },
  { value: "master", label: "Master" },
  { value: "mba", label: "MBA" },
  { value: "ingenieur", label: "Cycle ingénieur" },
  { value: "doctorat", label: "Doctorat" },
  { value: "language_stay", label: "Séjour linguistique" },
  { value: "bts_dut", label: "BTS / DUT" },
];

export const MATRIX_VISA_CENTERS = [
  { value: "TLS", label: "TLScontact" },
  { value: "VFS", label: "VFS Global" },
  { value: "Capago", label: "Capago" },
];

router.get("/document-matrix/reference", requireAuth, (_req, res) => {
  res.json({
    documentCategories: MATRIX_DOCUMENT_CATEGORIES,
    programLevels: MATRIX_PROGRAM_LEVELS,
    visaCenters: MATRIX_VISA_CENTERS,
  });
});

// ─── DOCUMENT MATRIX CRUD ────────────────────────────────────────────────
router.get("/document-matrix", requireAuth, async (req, res) => {
  if (!isStaff(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const nat = (req.query.nationalityCode as string | undefined)?.trim();
  const lvl = (req.query.programLevel as string | undefined)?.trim();
  const conds = [];
  if (nat) conds.push(eq(documentMatrixEntriesTable.nationalityCode, nat));
  if (lvl) conds.push(eq(documentMatrixEntriesTable.programLevel, lvl));
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select()
    .from(documentMatrixEntriesTable)
    .where(where)
    .orderBy(
      asc(documentMatrixEntriesTable.nationalityCode),
      asc(documentMatrixEntriesTable.programLevel),
    );
  res.json(rows);
});

router.get("/document-matrix/resolve", requireAuth, async (req, res) => {
  if (!isStaff(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const nationalityCode = (req.query.nationalityCode as string | undefined)?.trim();
  const programLevel = (req.query.programLevel as string | undefined)?.trim();
  if (!nationalityCode || !programLevel) {
    res.status(400).json({ error: "nationalityCode and programLevel are required" });
    return;
  }
  const resolved = await resolveMatrixEntry(nationalityCode, programLevel);
  res.json(resolved);
});

router.post(
  "/document-matrix",
  requireAuth,
  validateBody(CreateDocumentMatrixEntryBody),
  async (req, res) => {
    if (!isAdmin(req.currentUser!)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const body = req.body as typeof CreateDocumentMatrixEntryBody._type;
    // Enforce uniqueness on (nationalityCode, programLevel)
    const [existing] = await db
      .select({ id: documentMatrixEntriesTable.id })
      .from(documentMatrixEntriesTable)
      .where(
        and(
          eq(documentMatrixEntriesTable.nationalityCode, body.nationalityCode),
          eq(documentMatrixEntriesTable.programLevel, body.programLevel),
        ),
      );
    if (existing) {
      res
        .status(409)
        .json({ error: "An entry already exists for this nationality and program level" });
      return;
    }
    const [row] = await db
      .insert(documentMatrixEntriesTable)
      .values({
        nationalityCode: body.nationalityCode,
        programLevel: body.programLevel,
        documentCategories: body.documentCategories ?? [],
        visaCenter: body.visaCenter ?? null,
        campusFranceRequired: body.campusFranceRequired ?? true,
        notes: body.notes ?? null,
        version: 1,
        updatedBy: req.currentUser!.id,
      })
      .returning();
    await logAudit({
      userId: req.currentUser!.id,
      action: "create",
      entityType: "document_matrix_entry",
      entityId: row.id,
      details: JSON.stringify({
        nationalityCode: row.nationalityCode,
        programLevel: row.programLevel,
        documentCategories: row.documentCategories,
      }),
    });
    res.status(201).json(row);
  },
);

router.patch(
  "/document-matrix/:entryId",
  requireAuth,
  validateBody(UpdateDocumentMatrixEntryBody),
  async (req, res) => {
    if (!isAdmin(req.currentUser!)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const entryId = Number(req.params.entryId);
    if (!Number.isInteger(entryId)) {
      res.status(400).json({ error: "Invalid entryId" });
      return;
    }
    const [prev] = await db
      .select()
      .from(documentMatrixEntriesTable)
      .where(eq(documentMatrixEntriesTable.id, entryId));
    if (!prev) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = req.body as typeof UpdateDocumentMatrixEntryBody._type;
    // If the natural key changes, ensure the new (nationality, level) pair
    // is still unique so we don't silently shadow a sibling entry.
    if (
      body.nationalityCode !== prev.nationalityCode ||
      body.programLevel !== prev.programLevel
    ) {
      const [conflict] = await db
        .select({ id: documentMatrixEntriesTable.id })
        .from(documentMatrixEntriesTable)
        .where(
          and(
            eq(documentMatrixEntriesTable.nationalityCode, body.nationalityCode),
            eq(documentMatrixEntriesTable.programLevel, body.programLevel),
          ),
        );
      if (conflict && conflict.id !== entryId) {
        res
          .status(409)
          .json({ error: "Another entry already exists for this nationality and program level" });
        return;
      }
    }
    const [row] = await db
      .update(documentMatrixEntriesTable)
      .set({
        nationalityCode: body.nationalityCode,
        programLevel: body.programLevel,
        documentCategories: body.documentCategories ?? [],
        visaCenter: body.visaCenter ?? null,
        campusFranceRequired: body.campusFranceRequired ?? true,
        notes: body.notes ?? null,
        version: prev.version + 1,
        updatedBy: req.currentUser!.id,
        updatedAt: new Date(),
      })
      .where(eq(documentMatrixEntriesTable.id, entryId))
      .returning();
    await logAudit({
      userId: req.currentUser!.id,
      action: "update",
      entityType: "document_matrix_entry",
      entityId: row.id,
      details: JSON.stringify({
        before: {
          documentCategories: prev.documentCategories,
          visaCenter: prev.visaCenter,
          campusFranceRequired: prev.campusFranceRequired,
        },
        after: {
          documentCategories: row.documentCategories,
          visaCenter: row.visaCenter,
          campusFranceRequired: row.campusFranceRequired,
        },
        version: row.version,
      }),
    });
    res.json(row);
  },
);

router.delete("/document-matrix/:entryId", requireAuth, async (req, res) => {
  if (!isAdmin(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const entryId = Number(req.params.entryId);
  if (!Number.isInteger(entryId)) {
    res.status(400).json({ error: "Invalid entryId" });
    return;
  }
  await db
    .delete(documentMatrixEntriesTable)
    .where(eq(documentMatrixEntriesTable.id, entryId));
  await logAudit({
    userId: req.currentUser!.id,
    action: "delete",
    entityType: "document_matrix_entry",
    entityId: entryId,
  });
  res.status(204).end();
});

// ─── INTAKE CALENDAR CRUD ────────────────────────────────────────────────
// Admin-managed: full listing is staff-only. Students see their country's
// upcoming deadlines via the `/intake-calendar/upcoming` endpoint, which
// scopes the result to the caller's own nationality.
router.get("/intake-calendar", requireAuth, async (req, res) => {
  if (!isStaff(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const nat = (req.query.nationalityCode as string | undefined)?.trim();
  const where = nat
    ? eq(intakeCalendarEntriesTable.nationalityCode, nat)
    : undefined;
  const rows = await db
    .select()
    .from(intakeCalendarEntriesTable)
    .where(where)
    .orderBy(
      asc(intakeCalendarEntriesTable.windowEnd),
      asc(intakeCalendarEntriesTable.sortOrder),
    );
  res.json(rows);
});

router.get("/intake-calendar/upcoming", requireAuth, async (req, res) => {
  const u = req.currentUser!;
  let nationalityCode = (req.query.nationalityCode as string | undefined)?.trim();
  // Non-staff (students) are always force-scoped to their own nationality
  // so they can't peek into another country's calendar by passing a
  // different code.
  if (!isStaff(u)) {
    const [s] = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.userId, u.id));
    if (!s) {
      res.json([]);
      return;
    }
    nationalityCode = s.nationalityCode ?? undefined;
  }
  if (!nationalityCode) {
    res.json([]);
    return;
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 3, 1), 20);
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(intakeCalendarEntriesTable)
    .where(
      and(
        eq(intakeCalendarEntriesTable.nationalityCode, nationalityCode),
        gte(intakeCalendarEntriesTable.windowEnd, today),
      ),
    )
    .orderBy(
      asc(intakeCalendarEntriesTable.windowEnd),
      asc(intakeCalendarEntriesTable.sortOrder),
    )
    .limit(limit);
  res.json(rows);
});

router.post(
  "/intake-calendar",
  requireAuth,
  validateBody(CreateIntakeCalendarEntryBody),
  async (req, res) => {
    if (!isAdmin(req.currentUser!)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const body = req.body as typeof CreateIntakeCalendarEntryBody._type;
    const [row] = await db
      .insert(intakeCalendarEntriesTable)
      .values({
        nationalityCode: body.nationalityCode,
        label: body.label,
        deadlineType: body.deadlineType,
        windowStart: body.windowStart ?? null,
        windowEnd: body.windowEnd,
        academicYear: body.academicYear ?? null,
        notes: body.notes ?? null,
        sortOrder: body.sortOrder ?? 0,
        updatedBy: req.currentUser!.id,
      })
      .returning();
    await logAudit({
      userId: req.currentUser!.id,
      action: "create",
      entityType: "intake_calendar_entry",
      entityId: row.id,
    });
    res.status(201).json(row);
  },
);

router.patch(
  "/intake-calendar/:entryId",
  requireAuth,
  validateBody(UpdateIntakeCalendarEntryBody),
  async (req, res) => {
    if (!isAdmin(req.currentUser!)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const entryId = Number(req.params.entryId);
    if (!Number.isInteger(entryId)) {
      res.status(400).json({ error: "Invalid entryId" });
      return;
    }
    const body = req.body as typeof UpdateIntakeCalendarEntryBody._type;
    const [row] = await db
      .update(intakeCalendarEntriesTable)
      .set({
        nationalityCode: body.nationalityCode,
        label: body.label,
        deadlineType: body.deadlineType,
        windowStart: body.windowStart ?? null,
        windowEnd: body.windowEnd,
        academicYear: body.academicYear ?? null,
        notes: body.notes ?? null,
        sortOrder: body.sortOrder ?? 0,
        updatedBy: req.currentUser!.id,
        updatedAt: new Date(),
      })
      .where(eq(intakeCalendarEntriesTable.id, entryId))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await logAudit({
      userId: req.currentUser!.id,
      action: "update",
      entityType: "intake_calendar_entry",
      entityId: row.id,
    });
    res.json(row);
  },
);

router.delete("/intake-calendar/:entryId", requireAuth, async (req, res) => {
  if (!isAdmin(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const entryId = Number(req.params.entryId);
  if (!Number.isInteger(entryId)) {
    res.status(400).json({ error: "Invalid entryId" });
    return;
  }
  await db
    .delete(intakeCalendarEntriesTable)
    .where(eq(intakeCalendarEntriesTable.id, entryId));
  await logAudit({
    userId: req.currentUser!.id,
    action: "delete",
    entityType: "intake_calendar_entry",
    entityId: entryId,
  });
  res.status(204).end();
});

// ─── STUDENT CHECKLIST REFRESH ───────────────────────────────────────────
router.post(
  "/students/:studentId/refresh-checklist",
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
    const u = req.currentUser!;
    if (!isStaff(u) || !(await canAccessStudent(u, student))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const result = await applyMatrixToStudent(studentId, {
      nationalityCode: student.nationalityCode,
      programLevel: await loadProgramLevel(student.programId),
    });
    // Recompute completionScore so the UI reflects the refreshed plan
    // immediately, without waiting for the next step-status update.
    const allSteps = await db
      .select()
      .from(studentStepsTable)
      .where(eq(studentStepsTable.studentId, studentId));
    const requiredSteps = allSteps.filter((s) => s.isRequired);
    const denomList = requiredSteps.length > 0 ? requiredSteps : allSteps;
    const validated = denomList.filter((s) => s.status === "validated").length;
    const score = denomList.length > 0
      ? Math.round((validated / denomList.length) * 100)
      : 0;
    await db
      .update(studentsTable)
      .set({ completionScore: score, lastActivityAt: new Date() })
      .where(eq(studentsTable.id, studentId));
    await logAudit({
      userId: u.id,
      studentId: studentId,
      action: "refresh_checklist",
      entityType: "student",
      entityId: studentId,
      details: JSON.stringify(result),
    });
    res.json({
      studentId,
      refreshedAt: new Date().toISOString(),
      ...result,
    });
  },
);

// ─── HELPERS (used by /refresh-checklist and the student create flow) ────
export async function loadProgramLevel(
  programId: number | null,
): Promise<string | null> {
  if (!programId) return null;
  const { programsTable } = await import("@workspace/db");
  const [p] = await db
    .select({ level: programsTable.level })
    .from(programsTable)
    .where(eq(programsTable.id, programId));
  return p?.level ?? null;
}

export async function resolveMatrixEntry(
  nationalityCode: string | null | undefined,
  programLevel: string | null | undefined,
) {
  if (!nationalityCode || !programLevel) {
    return {
      nationalityCode: nationalityCode ?? "",
      programLevel: programLevel ?? "",
      entry: null,
      fallbackUsed: true,
      documentCategories: [],
      visaCenter: null,
      campusFranceRequired: true,
    };
  }
  // Exact match first; if none, fall back to a wildcard "*" program-level
  // entry for the same nationality (admins can publish a one-row-per-country
  // baseline). Visa center / Campus France flag fall back to the country's
  // own configuration.
  const [exact] = await db
    .select()
    .from(documentMatrixEntriesTable)
    .where(
      and(
        eq(documentMatrixEntriesTable.nationalityCode, nationalityCode),
        eq(documentMatrixEntriesTable.programLevel, programLevel),
      ),
    );
  if (exact) {
    return {
      nationalityCode,
      programLevel,
      entry: exact,
      fallbackUsed: false,
      documentCategories: exact.documentCategories,
      visaCenter: exact.visaCenter,
      campusFranceRequired: exact.campusFranceRequired,
    };
  }
  const [wildcard] = await db
    .select()
    .from(documentMatrixEntriesTable)
    .where(
      and(
        eq(documentMatrixEntriesTable.nationalityCode, nationalityCode),
        eq(documentMatrixEntriesTable.programLevel, "*"),
      ),
    );
  if (wildcard) {
    return {
      nationalityCode,
      programLevel,
      entry: wildcard,
      fallbackUsed: true,
      documentCategories: wildcard.documentCategories,
      visaCenter: wildcard.visaCenter,
      campusFranceRequired: wildcard.campusFranceRequired,
    };
  }
  return {
    nationalityCode,
    programLevel,
    entry: null,
    fallbackUsed: true,
    documentCategories: [],
    visaCenter: null,
    campusFranceRequired: true,
  };
}

const MATRIX_CHECKLIST_ANCHOR_STEP = "Constitution du dossier consulaire";
const MATRIX_SKIP_REASON = "Non requis pour cette nationalité (matrice)";

// Apply the per-nationality × program-level matrix authoritatively to a
// student's checklist. Behaviour:
//  • For every workflow step that has `requiredDocumentCategories`, if NONE
//    of its categories are in the matrix, the step is reconciled to
//    `skipped` (only when currently `pending`, never overrides progress)
//    and its unchecked required checklist items are pruned.
//  • Previously-skipped steps whose categories are re-included by the
//    matrix are restored to `pending`.
//  • Matrix categories not covered by any active step are anchored as
//    "Matrice nationalité : …" items on the consulate-dossier step.
//  • User-checked checklist items are NEVER deleted, regardless of state.
export async function applyMatrixToStudent(
  studentId: number,
  ctx: {
    nationalityCode: string | null | undefined;
    programLevel: string | null | undefined;
  },
) {
  const resolved = await resolveMatrixEntry(ctx.nationalityCode, ctx.programLevel);
  const matrixCats = new Set(resolved.documentCategories);
  // When no matrix entry resolves, leave the generic template untouched so
  // we never silently strip requirements for nationalities admins haven't
  // configured yet.
  const matrixApplies = matrixCats.size > 0;

  const existingSteps = await db
    .select()
    .from(studentStepsTable)
    .where(eq(studentStepsTable.studentId, studentId))
    .orderBy(asc(studentStepsTable.stepOrder));
  const wfStepIds = existingSteps.map((s) => s.workflowStepId);
  const wfSteps = wfStepIds.length
    ? await db
        .select()
        .from(workflowStepsTable)
        .where(inArray(workflowStepsTable.id, wfStepIds))
    : [];
  const wfById = new Map(wfSteps.map((s) => [s.id, s]));

  // Reconcile each student step's `isRequired` flag against the matrix:
  //   • Steps with no requiredDocumentCategories → keep template default.
  //   • Steps whose categories overlap the matrix → required (template).
  //   • Steps whose categories don't overlap the matrix → not required
  //     (non-applicable for this nationality / level).
  // We never touch `status`, so a student's in-progress / validated work
  // is preserved verbatim. This is non-blocking: validation logic only
  // gates progression on prior `isRequired` steps, and completion score
  // is computed over required steps only (see students.ts).
  let stepsSkipped = 0;
  let stepsRestored = 0;
  let removed = 0;
  if (matrixApplies) {
    for (const ss of existingSteps) {
      const ws = wfById.get(ss.workflowStepId);
      if (!ws) continue;
      const reqCats = ws.requiredDocumentCategories ?? [];
      if (reqCats.length === 0) continue; // non-document step → leave alone
      const overlaps = reqCats.some((c) => matrixCats.has(c));
      const desiredRequired = overlaps ? ws.isRequired : false;
      if (ss.isRequired !== desiredRequired) {
        await db
          .update(studentStepsTable)
          .set({
            isRequired: desiredRequired,
            notes: desiredRequired ? null : MATRIX_SKIP_REASON,
          })
          .where(eq(studentStepsTable.id, ss.id));
        if (!desiredRequired) {
          stepsSkipped++;
          // Step is no longer required → drop unchecked required checklist
          // items so the student isn't shown obligations that don't apply.
          const items = await db
            .select()
            .from(checklistItemsTable)
            .where(
              and(
                eq(checklistItemsTable.studentId, studentId),
                eq(checklistItemsTable.workflowStepId, ws.id),
                eq(checklistItemsTable.isRequired, true),
              ),
            );
          for (const it of items) {
            if (it.isChecked) continue;
            await db
              .delete(checklistItemsTable)
              .where(eq(checklistItemsTable.id, it.id));
            removed++;
          }
        } else {
          stepsRestored++;
        }
      }
    }
  }

  // For matrix-only anchoring, "covered" means a step that's still
  // required after reconciliation.
  const activeStepIds = new Set(
    existingSteps
      .filter((s) => {
        if (!matrixApplies) return true;
        const ws = wfById.get(s.workflowStepId);
        const reqCats = ws?.requiredDocumentCategories ?? [];
        if (reqCats.length === 0) return true;
        return reqCats.some((c) => matrixCats.has(c));
      })
      .map((s) => s.workflowStepId),
  );
  const coveredCats = new Set<string>();
  for (const s of wfSteps) {
    if (!activeStepIds.has(s.id)) continue;
    for (const c of s.requiredDocumentCategories ?? []) coveredCats.add(c);
  }

  // Anchor step where matrix-only items get attached. Prefer
  // "Constitution du dossier consulaire", else last non-CF step.
  let anchor = existingSteps.find(
    (s) => s.stepName === MATRIX_CHECKLIST_ANCHOR_STEP,
  );
  if (!anchor) {
    anchor = [...existingSteps]
      .reverse()
      .find((s) => !s.isCampusFranceStep);
  }
  if (!anchor) {
    return {
      stepsAdded: 0,
      checklistItemsAdded: 0,
      checklistItemsRemoved: 0,
      appliedMatrixEntryId: resolved.entry?.id ?? null,
      documentCategories: Array.from(matrixCats),
    };
  }

  const labels = new Map(
    MATRIX_DOCUMENT_CATEGORIES.map((c) => [c.value, c.label]),
  );
  const matrixOnlyCats = Array.from(matrixCats).filter(
    (c) => !coveredCats.has(c),
  );
  const matrixLabels = new Set(
    matrixOnlyCats.map(
      (c) => `Matrice nationalité : ${labels.get(c) ?? c}`,
    ),
  );

  const existingItems = await db
    .select()
    .from(checklistItemsTable)
    .where(
      and(
        eq(checklistItemsTable.studentId, studentId),
        eq(checklistItemsTable.workflowStepId, anchor.workflowStepId),
      ),
    );

  // Remove stale matrix-prefixed items the matrix no longer requires.
  const stale = existingItems.filter(
    (it) =>
      it.label.startsWith("Matrice nationalité : ") &&
      !matrixLabels.has(it.label),
  );
  for (const it of stale) {
    if (it.isChecked) continue; // never delete user-checked items
    await db
      .delete(checklistItemsTable)
      .where(eq(checklistItemsTable.id, it.id));
    removed++;
  }

  // Add missing matrix-driven items
  const presentLabels = new Set(existingItems.map((i) => i.label));
  let added = 0;
  let nextOrder =
    existingItems.reduce((mx, it) => Math.max(mx, it.order), 0) + 1;
  for (const c of matrixOnlyCats) {
    const label = `Matrice nationalité : ${labels.get(c) ?? c}`;
    if (presentLabels.has(label)) continue;
    await db.insert(checklistItemsTable).values({
      workflowStepId: anchor.workflowStepId,
      studentId,
      label,
      isRequired: true,
      isChecked: false,
      order: nextOrder++,
    });
    added++;
  }

  return {
    stepsAdded: stepsRestored,
    stepsSkipped,
    checklistItemsAdded: added,
    checklistItemsRemoved: removed,
    appliedMatrixEntryId: resolved.entry?.id ?? null,
    documentCategories: Array.from(matrixCats),
  };
}

// ─── BOOTSTRAP SEEDS ─────────────────────────────────────────────────────
// Idempotent: only inserts rows when the table is empty.
export async function ensureMatrixSeed(): Promise<void> {
  const [existing] = await db
    .select({ id: documentMatrixEntriesTable.id })
    .from(documentMatrixEntriesTable)
    .limit(1);
  if (!existing) {
    const baseDocs = [
      "passeport",
      "extrait_naissance",
      "photo_identite",
      "diplome",
      "releve_notes",
      "test_langue",
      "lettre_admission",
      "lettre_motivation",
      "cv",
      "justificatif_financier",
      "justificatif_hebergement",
      "assurance",
    ];
    const seedRows: {
      nationalityCode: string;
      programLevel: string;
      documentCategories: string[];
      visaCenter: string;
      campusFranceRequired: boolean;
      notes: string;
    }[] = [];
    const FRANCOPHONE = [
      "SN", "CI", "CM", "BJ", "BF", "ML", "TG", "GA", "CG", "MG",
      "MA", "DZ", "TN", "CD", "GN", "NE", "TD",
    ];
    const LEVELS = [
      "licence", "bachelor", "master", "mba", "ingenieur", "language_stay",
    ];
    for (const nat of FRANCOPHONE) {
      for (const lvl of LEVELS) {
        const cats = [...baseDocs];
        if (lvl === "master" || lvl === "mba" || lvl === "ingenieur") {
          cats.push("attestation_campus_france");
        }
        if (nat === "SN" || nat === "CI") {
          cats.push("casier_judiciaire");
        }
        seedRows.push({
          nationalityCode: nat,
          programLevel: lvl,
          documentCategories: cats,
          visaCenter: nat === "SN" ? "Capago" : "VFS",
          campusFranceRequired: true,
          notes: "Initial seed — admins should review per ambassade.",
        });
      }
    }
    await db.insert(documentMatrixEntriesTable).values(seedRows);
  }

  const [calExisting] = await db
    .select({ id: intakeCalendarEntriesTable.id })
    .from(intakeCalendarEntriesTable)
    .limit(1);
  if (!calExisting) {
    // Demo intake calendar — admins replace with real Campus France
    // deadlines once they're published. We seed three rolling deadlines
    // per francophone country so the student widget has something to
    // surface immediately.
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const academicYear = `${yyyy}-${yyyy + 1}`;
    const baseRows: {
      type: string;
      label: string;
      monthsAhead: number;
      sort: number;
    }[] = [
      {
        type: "campus_france",
        label: "Ouverture des candidatures Études en France",
        monthsAhead: 1,
        sort: 1,
      },
      {
        type: "campus_france",
        label: "Clôture des candidatures Études en France",
        monthsAhead: 4,
        sort: 2,
      },
      {
        type: "visa_appointment",
        label: "Période recommandée pour le rendez-vous TLS/VFS",
        monthsAhead: 7,
        sort: 3,
      },
    ];
    const COUNTRIES_WITH_CAL = [
      "SN", "CI", "CM", "BJ", "BF", "ML", "TG",
      "MA", "DZ", "TN", "CD", "GN",
    ];
    const rowsToInsert = COUNTRIES_WITH_CAL.flatMap((nat) =>
      baseRows.map((r) => {
        const d = new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + r.monthsAhead, 1),
        );
        const iso = d.toISOString().slice(0, 10);
        return {
          nationalityCode: nat,
          label: r.label,
          deadlineType: r.type,
          windowStart: null,
          windowEnd: iso,
          academicYear,
          notes: null,
          sortOrder: r.sort,
        };
      }),
    );
    await db.insert(intakeCalendarEntriesTable).values(rowsToInsert);
  }
}

export default router;
