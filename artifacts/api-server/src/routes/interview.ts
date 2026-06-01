import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  studentsTable,
  interviewsTable,
  interviewTurnsTable,
  schoolsTable,
  programsTable,
  countriesTable,
  type Interview,
  type InterviewTurn,
  type InterviewRubric,
} from "@workspace/db";
import { eq, asc, desc } from "drizzle-orm";
import { z } from "zod";
import { chat, transcribe, isGroqConfigured } from "@workspace/ai";
import { requireAuth, canAccessStudent } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { requireAiPlan, resolveDefaultTenantId } from "../lib/planGuard";

const router: IRouter = Router();

const MAX_TURNS = 6;

async function loadInterviewOr403(req: Request, res: Response) {
  const id = Number(req.params.interviewId);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid interviewId" });
    return null;
  }
  const [interview] = await db
    .select()
    .from(interviewsTable)
    .where(eq(interviewsTable.id, id));
  if (!interview) {
    res.status(404).json({ error: "Interview not found" });
    return null;
  }
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, interview.studentId));
  if (!student || !(await canAccessStudent(req.currentUser!, student))) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return { interview, student };
}

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

async function withTurns(interview: Interview): Promise<Interview & { turns: InterviewTurn[] }> {
  const turns = await db
    .select()
    .from(interviewTurnsTable)
    .where(eq(interviewTurnsTable.interviewId, interview.id))
    .orderBy(asc(interviewTurnsTable.turnIndex));
  return { ...interview, turns };
}

const NextQuestionAi = z.object({ question: z.string() });

async function generateNextQuestion(opts: {
  interview: Interview;
  history: InterviewTurn[];
  userId: number;
  tenantId?: number | null;
}): Promise<string> {
  const { interview, history } = opts;
  const transcriptBlocks = history.map((t) =>
    `${t.role === "interviewer" ? "Examinateur" : "Étudiant"}: ${t.content}`,
  );
  const profile = [
    interview.programName ? `programme: ${interview.programName}` : null,
    interview.schoolName ? `école: ${interview.schoolName}` : null,
    interview.countryName ? `pays d'origine: ${interview.countryName}` : null,
  ]
    .filter(Boolean)
    .join(", ") || "(profil partiel)";
  const result = await chat({
    ctx: {
      feature: "interview.next_question",
      userId: opts.userId,
      studentId: interview.studentId,
      tenantId: opts.tenantId ?? null,
    },
    messages: [
      {
        role: "system",
        content:
          "Tu es un examinateur Campus France francophone qui mène un entretien préalable au visa étudiant. Pose UNE question à la fois, en français, naturelle, qui creuse la motivation, la cohérence projet/parcours, le plan de retour, la connaissance du programme/école, et la maîtrise du français. Pas de numéros, pas de préambule. Renvoie STRICTEMENT du JSON: {\"question\":\"...\"}.",
      },
      {
        role: "user",
        content: `Profil: ${profile}.\nÉchanges déjà eus:\n${transcriptBlocks.join("\n") || "(aucun)"}\n\nDonne la prochaine question.`,
      },
    ],
    jsonSchema: NextQuestionAi,
    temperature: 0.7,
    maxTokens: 200,
  });
  return result.content.question.trim();
}

const RubricAi = z.object({
  score: z.object({
    motivation: z.number().min(0).max(10).optional(),
    coherence: z.number().min(0).max(10).optional(),
    french: z.number().min(0).max(10).optional(),
    knowledge: z.number().min(0).max(10).optional(),
    returnPlan: z.number().min(0).max(10).optional(),
    overall: z.number().min(0).max(10).optional(),
  }),
  feedback: z.string(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
});

async function gradeInterview(opts: {
  interview: Interview;
  turns: InterviewTurn[];
  userId: number;
  tenantId?: number | null;
}): Promise<{
  score: InterviewRubric;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}> {
  const transcript = opts.turns
    .map((t) => `${t.role === "interviewer" ? "Examinateur" : "Étudiant"}: ${t.content}`)
    .join("\n");
  const result = await chat({
    ctx: {
      feature: "interview.grade",
      userId: opts.userId,
      studentId: opts.interview.studentId,
      tenantId: opts.tenantId ?? null,
    },
    messages: [
      {
        role: "system",
        content:
          "Tu es un examinateur spécialisé dans les entretiens de motivation pour visa étudiant en école privée française. Évalue l'entretien sur 5 axes (motivation, coherence, french, knowledge, returnPlan — ce dernier = projet professionnel et insertion après les études, chacun de 0 à 10) et calcule un overall de 0 à 10. Donne un feedback factuel en français (5 à 8 phrases), 3 points forts, 3 axes de progrès, 3 suggestions concrètes. Réponds STRICTEMENT en JSON.",
      },
      {
        role: "user",
        content: `Programme: ${opts.interview.programName ?? "(inconnu)"} — École: ${opts.interview.schoolName ?? "(inconnue)"} — Pays: ${opts.interview.countryName ?? "(inconnu)"}\n\nTranscription:\n${transcript}`,
      },
    ],
    jsonSchema: RubricAi,
    temperature: 0.2,
    maxTokens: 1500,
  });
  return {
    score: result.content.score,
    feedback: result.content.feedback,
    strengths: result.content.strengths ?? [],
    weaknesses: result.content.weaknesses ?? [],
    suggestions: result.content.suggestions ?? [],
  };
}

// ─── GET list ───────────────────────────────────────────────────────────────
router.get("/students/:studentId/interviews", requireAuth, async (req, res) => {
  const student = await loadStudentOr403(req, res);
  if (!student) return;
  const rows = await db
    .select()
    .from(interviewsTable)
    .where(eq(interviewsTable.studentId, student.id))
    .orderBy(desc(interviewsTable.createdAt));
  res.json(rows);
});

// ─── POST start interview ───────────────────────────────────────────────────
router.post("/students/:studentId/interviews", requireAuth, async (req, res) => {
  const student = await loadStudentOr403(req, res);
  if (!student) return;
  const mode = req.body?.mode === "voice" ? "voice" : "text";
  const language = typeof req.body?.language === "string" ? req.body.language : "fr";
  if (!isGroqConfigured()) {
    res.status(503).json({ error: "AI non configurée" });
    return;
  }
  if (!(await requireAiPlan(res, "Simulateur d'entretien"))) return;
  // Snapshot school/program/country at start so the report stays stable.
  const school = student.schoolId
    ? (await db.select().from(schoolsTable).where(eq(schoolsTable.id, student.schoolId)))[0]
    : null;
  const program = student.programId
    ? (await db.select().from(programsTable).where(eq(programsTable.id, student.programId)))[0]
    : null;
  const country = student.countryId
    ? (await db.select().from(countriesTable).where(eq(countriesTable.id, student.countryId)))[0]
    : null;
  const [created] = await db
    .insert(interviewsTable)
    .values({
      studentId: student.id,
      mode,
      status: "in_progress",
      programName: program?.name ?? null,
      schoolName: school?.name ?? null,
      countryName: country?.name ?? null,
      language,
    })
    .returning();
  try {
    const tenantId = await resolveDefaultTenantId();
    const opening = await generateNextQuestion({
      interview: created,
      history: [],
      userId: req.currentUser!.id,
      tenantId,
    });
    await db.insert(interviewTurnsTable).values({
      interviewId: created.id,
      turnIndex: 0,
      role: "interviewer",
      content: opening,
    });
  } catch (err) {
    // If question generation fails we still return the interview row so the
    // client can retry; mark it abandoned-eligible instead of crashing.
    await db.insert(interviewTurnsTable).values({
      interviewId: created.id,
      turnIndex: 0,
      role: "interviewer",
      content:
        "Bonjour, présentez-vous brièvement et expliquez pourquoi vous souhaitez étudier en France.",
    });
  }
  await logAudit({
    userId: req.currentUser!.id,
    studentId: student.id,
    action: "interview.start",
    entityType: "interview",
    entityId: created.id,
  });
  res.status(201).json(await withTurns(created));
});

// ─── GET single interview ──────────────────────────────────────────────────
router.get("/interviews/:interviewId", requireAuth, async (req, res) => {
  const ctx = await loadInterviewOr403(req, res);
  if (!ctx) return;
  res.json(await withTurns(ctx.interview));
});

async function appendStudentAnswerAndNextQuestion(opts: {
  interview: Interview;
  studentAnswer: string;
  audioPath?: string | null;
  transcription?: string | null;
  userId: number;
  res: Response;
}): Promise<void> {
  const { interview, studentAnswer, userId, res } = opts;
  if (interview.status !== "in_progress") {
    res.status(400).json({ error: "Entretien terminé" });
    return;
  }
  const turns = await db
    .select()
    .from(interviewTurnsTable)
    .where(eq(interviewTurnsTable.interviewId, interview.id))
    .orderBy(asc(interviewTurnsTable.turnIndex));
  const lastIdx = turns.at(-1)?.turnIndex ?? -1;
  await db.insert(interviewTurnsTable).values({
    interviewId: interview.id,
    turnIndex: lastIdx + 1,
    role: "student",
    content: studentAnswer,
    audioPath: opts.audioPath ?? null,
    transcription: opts.transcription ?? null,
  });
  // Count question/answer pairs (one Q + one A = 1 turn). If we've reached
  // MAX_TURNS, do not ask another question — the client should call /finish.
  const studentTurnCount = turns.filter((t) => t.role === "student").length + 1;
  if (studentTurnCount < MAX_TURNS) {
    try {
      const refreshed = await db
        .select()
        .from(interviewTurnsTable)
        .where(eq(interviewTurnsTable.interviewId, interview.id))
        .orderBy(asc(interviewTurnsTable.turnIndex));
      const tenantId = await resolveDefaultTenantId();
      const next = await generateNextQuestion({
        interview,
        history: refreshed,
        userId,
        tenantId,
      });
      await db.insert(interviewTurnsTable).values({
        interviewId: interview.id,
        turnIndex: lastIdx + 2,
        role: "interviewer",
        content: next,
      });
    } catch {
      // best-effort — client can retry by re-fetching
    }
  }
  res.json(await withTurns(interview));
}

// ─── POST text answer ───────────────────────────────────────────────────────
router.post("/interviews/:interviewId/turn", requireAuth, async (req, res) => {
  const ctx = await loadInterviewOr403(req, res);
  if (!ctx) return;
  const answer = String(req.body?.answer ?? "").trim();
  if (!answer) {
    res.status(400).json({ error: "Réponse vide" });
    return;
  }
  if (!isGroqConfigured()) {
    res.status(503).json({ error: "AI non configurée" });
    return;
  }
  if (!(await requireAiPlan(res, "Simulateur d'entretien"))) return;
  await appendStudentAnswerAndNextQuestion({
    interview: ctx.interview,
    studentAnswer: answer,
    userId: req.currentUser!.id,
    res,
  });
});

// ─── POST audio answer (base64 webm/m4a etc.) ───────────────────────────────
router.post("/interviews/:interviewId/transcribe", requireAuth, async (req, res) => {
  const ctx = await loadInterviewOr403(req, res);
  if (!ctx) return;
  const { audioBase64, mimeType } = (req.body ?? {}) as { audioBase64?: string; mimeType?: string };
  if (!audioBase64 || typeof audioBase64 !== "string") {
    res.status(400).json({ error: "audioBase64 requis" });
    return;
  }
  if (!isGroqConfigured()) {
    res.status(503).json({ error: "AI non configurée" });
    return;
  }
  if (!(await requireAiPlan(res, "Simulateur d'entretien (voix)"))) return;
  let buf: Buffer;
  try {
    buf = Buffer.from(audioBase64, "base64");
  } catch {
    res.status(400).json({ error: "audio invalide" });
    return;
  }
  if (buf.length === 0 || buf.length > 25 * 1024 * 1024) {
    res.status(400).json({ error: "audio vide ou > 25 MB" });
    return;
  }
  const ext = mimeType?.includes("mp4") || mimeType?.includes("m4a")
    ? "m4a"
    : mimeType?.includes("wav")
      ? "wav"
      : "webm";
  let transcribed = "";
  try {
    const tenantId = await resolveDefaultTenantId();
    const out = await transcribe({
      ctx: {
        feature: "interview.transcribe",
        userId: req.currentUser!.id,
        studentId: ctx.interview.studentId,
        tenantId,
      },
      audio: buf,
      filename: `turn-${Date.now()}.${ext}`,
      language: ctx.interview.language || "fr",
    });
    transcribed = out.text.trim();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Transcription failed" });
    return;
  }
  if (!transcribed) {
    res.status(400).json({ error: "Transcription vide" });
    return;
  }
  await appendStudentAnswerAndNextQuestion({
    interview: ctx.interview,
    studentAnswer: transcribed,
    transcription: transcribed,
    userId: req.currentUser!.id,
    res,
  });
});

// ─── POST finish ────────────────────────────────────────────────────────────
router.post("/interviews/:interviewId/finish", requireAuth, async (req, res) => {
  const ctx = await loadInterviewOr403(req, res);
  if (!ctx) return;
  if (ctx.interview.status === "completed") {
    res.json(await withTurns(ctx.interview));
    return;
  }
  if (!isGroqConfigured()) {
    res.status(503).json({ error: "AI non configurée" });
    return;
  }
  if (!(await requireAiPlan(res, "Bilan d'entretien"))) return;
  const turns = await db
    .select()
    .from(interviewTurnsTable)
    .where(eq(interviewTurnsTable.interviewId, ctx.interview.id))
    .orderBy(asc(interviewTurnsTable.turnIndex));
  const studentTurns = turns.filter((t) => t.role === "student");
  if (studentTurns.length === 0) {
    res.status(400).json({ error: "Aucune réponse à évaluer" });
    return;
  }
  try {
    const tenantId = await resolveDefaultTenantId();
    const grade = await gradeInterview({
      interview: ctx.interview,
      turns,
      userId: req.currentUser!.id,
      tenantId,
    });
    const score: InterviewRubric = grade.score;
    const [updated] = await db
      .update(interviewsTable)
      .set({
        status: "completed",
        completedAt: new Date(),
        score,
        feedback: grade.feedback,
        strengths: grade.strengths ?? [],
        weaknesses: grade.weaknesses ?? [],
        suggestions: grade.suggestions ?? [],
      })
      .where(eq(interviewsTable.id, ctx.interview.id))
      .returning();
    await logAudit({
      userId: req.currentUser!.id,
      studentId: ctx.interview.studentId,
      action: "interview.finish",
      entityType: "interview",
      entityId: ctx.interview.id,
    });
    res.json(await withTurns(updated));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "AI error" });
  }
});

export default router;
