import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  studentsTable,
  scholarshipsTable,
  financialProofsTable,
  accommodationRecordsTable,
  cvecPaymentsTable,
} from "@workspace/db";
import { eq, and, asc, desc } from "drizzle-orm";
import {
  requireAuth,
  canAccessStudent,
  isAdmin,
  isStaff,
} from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import { logAudit } from "../lib/audit";
import {
  CreateFinancialProofBody,
  UpdateFinancialProofBody,
  CreateAccommodationRecordBody,
  UpdateAccommodationRecordBody,
  UpsertCvecPaymentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

export const DEFAULT_MONTHLY_MIN_EUR = 615;
const BANK_ATTESTATION_VALIDITY_MONTHS = 3;

function parseIdParam(name: string, req: Request, res: Response): number | null {
  const raw = req.params[name];
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    res.status(400).json({ error: `Invalid ${name}` });
    return null;
  }
  return n;
}

// Students may create/update their own evidence rows but they MUST NOT be
// able to self-assert review states like "valid" / "paid" / "exempted" —
// those are gated by staff review and feed into the submission readiness
// gate. This sanitizer strips/forces the status field on writes coming from
// student callers; staff/admin/reviewer/advisor pass through unchanged.
type WithStatus = { status?: string | null };
function sanitizeProofStatus<T extends WithStatus>(
  body: T,
  req: Request,
  existingStatus?: string,
): T {
  if (isStaff(req.currentUser!)) return body;
  const out: T = { ...body };
  // Force pending on student-driven writes; never let students promote.
  if (existingStatus && existingStatus !== "pending") {
    delete out.status;
  } else {
    out.status = "pending";
  }
  return out;
}

async function loadStudentOr403(req: Request, res: Response) {
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

function addMonthsIso(dateStr: string, months: number): string | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function computeProofExpiry(
  proofType: string,
  issueDate: string | null | undefined,
  explicit: string | null | undefined,
): string | null {
  if (explicit) return explicit;
  if (proofType === "bank_attestation" && issueDate) {
    return addMonthsIso(issueDate, BANK_ATTESTATION_VALIDITY_MONTHS);
  }
  return null;
}

function todayIsoDate(today = new Date()): string {
  return today.toISOString().slice(0, 10);
}

// Date-only comparison: a proof remains valid through the entire expiry day
// and only becomes "expired" the day *after*. Compares YYYY-MM-DD strings.
function isExpired(expiryDate: string | null | undefined, today = new Date()): boolean {
  if (!expiryDate) return false;
  const expiryIso = expiryDate.length >= 10 ? expiryDate.slice(0, 10) : expiryDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryIso)) return false;
  return expiryIso < todayIsoDate(today);
}

function deriveProofStatus(row: {
  proofType: string;
  issueDate: string | null;
  expiryDate: string | null;
  status: string;
}): string {
  if (row.status === "rejected") return "rejected";
  if (isExpired(row.expiryDate)) return "expired";
  return row.status === "valid" ? "valid" : "pending";
}

function diffMonths(startIso: string, endIso: string): number {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const months =
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  // partial month rounded up if the end day >= start day
  return Math.max(months, 0);
}

function currentAcademicYear(today = new Date()): string {
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-based
  // CVEC year runs Jul–Aug; treat July as start of new academic year
  return m >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

// ─── REFERENCE: STATIC ENUMS ────────────────────────────────────────────────
const PROOF_TYPES_REF = [
  { value: "bank_attestation", label: "Attestation bancaire", validityMonths: 3 },
  { value: "scholarship_letter", label: "Lettre de bourse", validityMonths: null },
  { value: "guarantor_declaration", label: "Déclaration de garant", validityMonths: null },
  { value: "avi_certificate", label: "Certificat AVI", validityMonths: null },
  { value: "other", label: "Autre", validityMonths: null },
];
const ACCOMMODATION_TYPES_REF = [
  { value: "crous", label: "CROUS" },
  { value: "private_lease", label: "Bail privé" },
  { value: "host_attestation", label: "Attestation d'hébergement (hôte)" },
  { value: "student_residence", label: "Résidence étudiante" },
  { value: "hotel_temporary", label: "Hôtel temporaire" },
  { value: "other", label: "Autre" },
];
const CVEC_AMOUNT_BY_YEAR: Record<string, number> = {
  // Tarif officiel publié chaque année par le CROUS / MESR
  "2024-2025": 103,
  "2025-2026": 103,
  "2026-2027": 113,
};
const DEFAULT_CVEC_AMOUNT_EUR = 113;

router.get("/finance-reference", requireAuth, (_req, res) => {
  const academicYear = currentAcademicYear();
  res.json({
    proofTypes: PROOF_TYPES_REF,
    accommodationTypes: ACCOMMODATION_TYPES_REF,
    bankAttestationValidityMonths: BANK_ATTESTATION_VALIDITY_MONTHS,
    monthlyMinimumEur: DEFAULT_MONTHLY_MIN_EUR,
    currentAcademicYear: academicYear,
    cvecAmountEur:
      CVEC_AMOUNT_BY_YEAR[academicYear] ?? DEFAULT_CVEC_AMOUNT_EUR,
    cvecAmountByYear: CVEC_AMOUNT_BY_YEAR,
  });
});

// ─── REFERENCE: SCHOLARSHIPS ────────────────────────────────────────────────
router.get("/scholarships", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(scholarshipsTable)
    .where(eq(scholarshipsTable.isActive, true))
    .orderBy(asc(scholarshipsTable.name));
  res.json(rows);
});

// ─── FINANCIAL PROOFS ───────────────────────────────────────────────────────
router.get(
  "/students/:studentId/financial-proofs",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const rows = await db
      .select()
      .from(financialProofsTable)
      .where(eq(financialProofsTable.studentId, student.id))
      .orderBy(desc(financialProofsTable.issueDate));
    res.json(
      rows.map((r) => ({
        ...r,
        derivedStatus: deriveProofStatus(r),
      })),
    );
  },
);

router.post(
  "/students/:studentId/financial-proofs",
  requireAuth,
  validateBody(CreateFinancialProofBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const body = req.body ?? {};
    const expiryDate = computeProofExpiry(
      body.proofType,
      body.issueDate,
      body.expiryDate,
    );
    const safeBody = sanitizeProofStatus(body, req);
    const [created] = await db
      .insert(financialProofsTable)
      .values({
        ...safeBody,
        studentId: student.id,
        expiryDate,
      })
      .returning();
    await logAudit({
      userId: req.currentUser!.id,
      studentId: student.id,
      action: "financial_proof.create",
      entityType: "financial_proof",
      entityId: created.id,
    });
    res.status(201).json(created);
  },
);

router.patch(
  "/students/:studentId/financial-proofs/:proofId",
  requireAuth,
  validateBody(UpdateFinancialProofBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const proofId = parseIdParam("proofId", req, res);
    if (proofId === null) return;
    const [existing] = await db
      .select()
      .from(financialProofsTable)
      .where(
        and(
          eq(financialProofsTable.id, proofId),
          eq(financialProofsTable.studentId, student.id),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Proof not found" });
      return;
    }
    const body = req.body ?? {};
    const proofType = body.proofType ?? existing.proofType;
    const issueDate = body.issueDate ?? existing.issueDate;
    const expiryDate =
      body.expiryDate !== undefined
        ? body.expiryDate
        : body.issueDate !== undefined || body.proofType !== undefined
          ? computeProofExpiry(proofType, issueDate, null)
          : existing.expiryDate;
    const safeBody = sanitizeProofStatus(body, req, existing.status);
    const [updated] = await db
      .update(financialProofsTable)
      .set({ ...safeBody, expiryDate, updatedAt: new Date() })
      .where(eq(financialProofsTable.id, proofId))
      .returning();
    res.json(updated);
  },
);

router.delete(
  "/students/:studentId/financial-proofs/:proofId",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const proofId = parseIdParam("proofId", req, res);
    if (proofId === null) return;
    const [deleted] = await db
      .delete(financialProofsTable)
      .where(
        and(
          eq(financialProofsTable.id, proofId),
          eq(financialProofsTable.studentId, student.id),
        ),
      )
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Proof not found" });
      return;
    }
    res.status(204).end();
  },
);

// ─── ACCOMMODATION ──────────────────────────────────────────────────────────
router.get(
  "/students/:studentId/accommodation",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const rows = await db
      .select()
      .from(accommodationRecordsTable)
      .where(eq(accommodationRecordsTable.studentId, student.id))
      .orderBy(desc(accommodationRecordsTable.startDate));
    res.json(rows);
  },
);

router.post(
  "/students/:studentId/accommodation",
  requireAuth,
  validateBody(CreateAccommodationRecordBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const safeBody = sanitizeProofStatus(req.body ?? {}, req);
    const [created] = await db
      .insert(accommodationRecordsTable)
      .values({ ...safeBody, studentId: student.id })
      .returning();
    await logAudit({
      userId: req.currentUser!.id,
      studentId: student.id,
      action: "accommodation.create",
      entityType: "accommodation_record",
      entityId: created.id,
    });
    res.status(201).json(created);
  },
);

router.patch(
  "/students/:studentId/accommodation/:recordId",
  requireAuth,
  validateBody(UpdateAccommodationRecordBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const recordId = parseIdParam("recordId", req, res);
    if (recordId === null) return;
    const [existing] = await db
      .select()
      .from(accommodationRecordsTable)
      .where(
        and(
          eq(accommodationRecordsTable.id, recordId),
          eq(accommodationRecordsTable.studentId, student.id),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Record not found" });
      return;
    }
    const safeBody = sanitizeProofStatus(req.body ?? {}, req, existing.status);
    const [updated] = await db
      .update(accommodationRecordsTable)
      .set({ ...safeBody, updatedAt: new Date() })
      .where(eq(accommodationRecordsTable.id, recordId))
      .returning();
    res.json(updated);
  },
);

router.delete(
  "/students/:studentId/accommodation/:recordId",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const recordId = parseIdParam("recordId", req, res);
    if (recordId === null) return;
    const [deleted] = await db
      .delete(accommodationRecordsTable)
      .where(
        and(
          eq(accommodationRecordsTable.id, recordId),
          eq(accommodationRecordsTable.studentId, student.id),
        ),
      )
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Record not found" });
      return;
    }
    res.status(204).end();
  },
);

// ─── CVEC ───────────────────────────────────────────────────────────────────
router.get("/students/:studentId/cvec", requireAuth, async (req, res) => {
  const student = await loadStudentOr403(req, res);
  if (!student) return;
  const rows = await db
    .select()
    .from(cvecPaymentsTable)
    .where(eq(cvecPaymentsTable.studentId, student.id))
    .orderBy(desc(cvecPaymentsTable.academicYear));
  res.json(rows);
});

router.put(
  "/students/:studentId/cvec",
  requireAuth,
  validateBody(UpsertCvecPaymentBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const body = req.body ?? {};
    const academicYear = body.academicYear ?? currentAcademicYear();
    const [existing] = await db
      .select()
      .from(cvecPaymentsTable)
      .where(
        and(
          eq(cvecPaymentsTable.studentId, student.id),
          eq(cvecPaymentsTable.academicYear, academicYear),
        ),
      );
    const safeBody = sanitizeProofStatus(body, req, existing?.status);
    let saved;
    if (existing) {
      [saved] = await db
        .update(cvecPaymentsTable)
        .set({ ...safeBody, academicYear, updatedAt: new Date() })
        .where(eq(cvecPaymentsTable.id, existing.id))
        .returning();
    } else {
      [saved] = await db
        .insert(cvecPaymentsTable)
        .values({ ...safeBody, studentId: student.id, academicYear })
        .returning();
    }
    await logAudit({
      userId: req.currentUser!.id,
      studentId: student.id,
      action: "cvec.upsert",
      entityType: "cvec_payment",
      entityId: saved.id,
    });
    res.json(saved);
  },
);

// ─── FINANCIAL READINESS AGGREGATE ──────────────────────────────────────────
export async function computeFinancialReadiness(studentId: number) {
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId));
  if (!student) return null;

  const proofs = await db
    .select()
    .from(financialProofsTable)
    .where(eq(financialProofsTable.studentId, studentId));
  const accommodations = await db
    .select()
    .from(accommodationRecordsTable)
    .where(eq(accommodationRecordsTable.studentId, studentId));
  const targetAcademicYear = currentAcademicYear();
  const cvec = await db
    .select()
    .from(cvecPaymentsTable)
    .where(eq(cvecPaymentsTable.studentId, studentId))
    .orderBy(desc(cvecPaymentsTable.academicYear));

  const monthlyMin = student.monthlyMinimumEur ?? DEFAULT_MONTHLY_MIN_EUR;
  let durationMonths = 0;
  if (student.intakeDate && student.programEndDate) {
    durationMonths = diffMonths(student.intakeDate, student.programEndDate);
  }
  // Default to 12 months if dates incomplete
  const effectiveMonths = durationMonths > 0 ? durationMonths : 12;
  const requiredAmountEur = effectiveMonths * monthlyMin;

  const validProofs = proofs.filter(
    (p) => deriveProofStatus(p) === "valid",
  );
  const totalValidEur = validProofs.reduce(
    (sum, p) => sum + Number(p.amountEur ?? 0),
    0,
  );
  const expiredProofs = proofs.filter(
    (p) => deriveProofStatus(p) === "expired",
  );

  const validAccommodation = accommodations.find(
    (a) => a.status === "valid",
  );

  // CVEC is only "ready" when the *current academic year* has a paid or
  // exempted payment; older years are informational.
  const cvecCurrent = cvec.find(
    (c) =>
      c.academicYear === targetAcademicYear &&
      (c.status === "paid" || c.status === "exempted"),
  );

  const reasons: string[] = [];
  const financeReady = totalValidEur >= requiredAmountEur;
  if (!financeReady) {
    if (proofs.length === 0) {
      reasons.push("Aucun justificatif financier renseigné.");
    } else {
      reasons.push(
        `Garantie financière insuffisante: ${totalValidEur.toFixed(0)}€ / ${requiredAmountEur}€ requis.`,
      );
    }
  }
  if (expiredProofs.length > 0) {
    reasons.push(
      `${expiredProofs.length} justificatif(s) expiré(s) à renouveler.`,
    );
  }
  const accommodationReady = !!validAccommodation;
  if (!accommodationReady) {
    reasons.push("Aucun justificatif d'hébergement validé.");
  }
  const cvecReady = !!cvecCurrent;
  if (!cvecReady) {
    reasons.push(
      `Paiement CVEC manquant ou non validé pour l'année ${targetAcademicYear}.`,
    );
  }

  const ready = financeReady && accommodationReady && cvecReady;

  return {
    studentId,
    monthlyMinimumEur: monthlyMin,
    programDurationMonths: effectiveMonths,
    programDurationIsEstimated: durationMonths === 0,
    requiredAmountEur,
    totalValidAmountEur: Number(totalValidEur.toFixed(2)),
    intakeDate: student.intakeDate,
    programEndDate: student.programEndDate,
    proofsCount: proofs.length,
    expiredProofsCount: expiredProofs.length,
    financeReady,
    accommodationReady,
    cvecReady,
    ready,
    overrideActive: !!student.submissionGateOverride,
    overrideReason: student.submissionGateOverrideReason,
    blockingReasons: reasons,
    cvecCurrent: cvecCurrent ?? null,
    validAccommodation: validAccommodation ?? null,
  };
}

router.get(
  "/students/:studentId/financial-readiness",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const result = await computeFinancialReadiness(student.id);
    res.json(result);
  },
);

router.post(
  "/students/:studentId/submission-gate-override",
  requireAuth,
  async (req, res) => {
    if (!isAdmin(req.currentUser!)) {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    const studentId = parseIdParam("studentId", req, res);
    if (studentId === null) return;
    const reason = (req.body?.reason ?? "").toString().trim();
    const enable = req.body?.enable !== false;
    if (enable && !reason) {
      res.status(400).json({ error: "reason is required to enable override" });
      return;
    }
    const [updated] = await db
      .update(studentsTable)
      .set({
        submissionGateOverride: enable,
        submissionGateOverrideReason: enable ? reason : null,
        updatedAt: new Date(),
      })
      .where(eq(studentsTable.id, studentId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    await logAudit({
      userId: req.currentUser!.id,
      studentId,
      action: enable ? "submission_gate.override_on" : "submission_gate.override_off",
      entityType: "student",
      entityId: studentId,
      details: JSON.stringify({ reason }),
    });
    res.json({ submissionGateOverride: updated.submissionGateOverride, reason });
  },
);

export default router;
