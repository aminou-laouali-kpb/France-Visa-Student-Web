import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  studentsTable,
  riskScoresTable,
  copilotFeedbackTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { isGroqConfigured } from "@workspace/ai";
import { requireAuth, isStaff, canAccessStudent } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { requireAiPlan, resolveDefaultTenantId } from "../lib/planGuard";
import { calculateRiskScore } from "../lib/risk";
import {
  buildRiskNarrative,
  buildCopilotSummary,
  hashRiskSignals,
  loadDossierContext,
} from "../lib/copilot";

const router: IRouter = Router();

async function loadStudentOr403(req: Request, res: Response) {
  const id = Number(req.params.studentId);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid studentId" });
    return null;
  }
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

function staffOnly(req: Request, res: Response): boolean {
  if (!isStaff(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

// ─── GET cached risk narrative ──────────────────────────────────────────────
router.get("/students/:studentId/risk/narrative", requireAuth, async (req, res) => {
  const student = await loadStudentOr403(req, res);
  if (!student) return;
  if (!staffOnly(req, res)) return;
  const [risk] = await db
    .select()
    .from(riskScoresTable)
    .where(eq(riskScoresTable.studentId, student.id));
  if (!risk) {
    res.json({ narrative: null });
    return;
  }
  res.json({
    narrative: risk.narrativeText ?? null,
    signalsHash: risk.narrativeSignalsHash ?? null,
    updatedAt: risk.narrativeUpdatedAt ? risk.narrativeUpdatedAt.toISOString() : null,
    score: risk.score,
    level: risk.level,
  });
});

// ─── POST regenerate narrative (recompute risk + AI explanation) ────────────
router.post("/students/:studentId/risk/narrative", requireAuth, async (req, res) => {
  const student = await loadStudentOr403(req, res);
  if (!student) return;
  if (!staffOnly(req, res)) return;
  if (!isGroqConfigured()) {
    res.status(503).json({ error: "AI non configurée" });
    return;
  }
  if (!(await requireAiPlan(res, "Explication IA du risque"))) return;
  // Always recompute the underlying signals so the narrative cannot lag
  // behind document/task updates.
  const fresh = await calculateRiskScore(student.id);
  const hash = hashRiskSignals(fresh);
  const [existing] = await db
    .select()
    .from(riskScoresTable)
    .where(eq(riskScoresTable.studentId, student.id));
  // Cache hit: signals didn't change since last narrative — return existing.
  if (existing?.narrativeText && existing.narrativeSignalsHash === hash) {
    res.json({
      narrative: existing.narrativeText,
      signalsHash: hash,
      updatedAt: existing.narrativeUpdatedAt?.toISOString() ?? null,
      score: existing.score,
      level: existing.level,
    });
    return;
  }
  try {
    const tenantId = await resolveDefaultTenantId();
    const narrative = await buildRiskNarrative({
      student,
      risk: existing ?? fresh,
      userId: req.currentUser!.id,
      tenantId,
    });
    const now = new Date();
    await db
      .update(riskScoresTable)
      .set({
        narrativeText: narrative,
        narrativeSignalsHash: hash,
        narrativeUpdatedAt: now,
      })
      .where(eq(riskScoresTable.studentId, student.id));
    await logAudit({
      userId: req.currentUser!.id,
      studentId: student.id,
      action: "copilot.risk_narrative",
      entityType: "risk_score",
      entityId: existing?.id ?? null,
    });
    res.json({
      narrative,
      signalsHash: hash,
      updatedAt: now.toISOString(),
      score: (existing ?? fresh).score,
      level: (existing ?? fresh).level,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "AI error" });
  }
});

// ─── POST advisor copilot summary ───────────────────────────────────────────
router.post("/students/:studentId/copilot/summary", requireAuth, async (req, res) => {
  const student = await loadStudentOr403(req, res);
  if (!student) return;
  if (!staffOnly(req, res)) return;
  if (!isGroqConfigured()) {
    res.status(503).json({ error: "AI non configurée" });
    return;
  }
  if (!(await requireAiPlan(res, "Copilote conseiller"))) return;
  const ctx = await loadDossierContext(student.id);
  if (!ctx) {
    res.status(404).json({ error: "Dossier introuvable" });
    return;
  }
  try {
    const tenantId = await resolveDefaultTenantId();
    const summary = await buildCopilotSummary({
      ctx,
      userId: req.currentUser!.id,
      tenantId,
    });
    await logAudit({
      userId: req.currentUser!.id,
      studentId: student.id,
      action: "copilot.summary",
      entityType: "student",
      entityId: student.id,
    });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "AI error" });
  }
});

// ─── POST thumbs feedback ───────────────────────────────────────────────────
router.post("/copilot/feedback", requireAuth, async (req, res) => {
  const { studentId, feature, vote, comment, promptHash } = (req.body ?? {}) as {
    studentId?: number;
    feature?: string;
    vote?: string;
    comment?: string;
    promptHash?: string;
  };
  if (!studentId || !feature || (vote !== "up" && vote !== "down")) {
    res.status(400).json({ error: "studentId, feature et vote (up|down) requis" });
    return;
  }
  if (!staffOnly(req, res)) return;
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId));
  if (!student || !(await canAccessStudent(req.currentUser!, student))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.insert(copilotFeedbackTable).values({
    studentId,
    userId: req.currentUser!.id,
    feature,
    vote,
    comment: comment ?? null,
    promptHash: promptHash ?? null,
  });
  res.status(204).send();
});

export default router;
