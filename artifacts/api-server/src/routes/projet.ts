import { Router, type IRouter } from "express";
import {
  db,
  studentsTable,
  eefWishesTable,
  projetEtudesTable,
  projetEtudesVersionsTable,
  motivationLettersTable,
  motivationLetterVersionsTable,
  schoolsTable,
  programsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { chat, isGroqConfigured } from "@workspace/ai";
import { requireAuth, canAccessStudent } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import {
  UpsertProjetEtudesBody,
  UpsertMotivationLetterBody,
  ImproveProjetEtudesParagraphBody,
  ImproveMotivationLetterParagraphBody,
} from "@workspace/api-zod";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

function countWords(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

async function loadStudentOr403(req: any, res: any) {
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

const RubricScoreSchema = z.object({
  coherence: z.number().min(0).max(10).optional().nullable(),
  french: z.number().min(0).max(10).optional().nullable(),
  specificity: z.number().min(0).max(10).optional().nullable(),
  returnPlan: z.number().min(0).max(10).optional().nullable(),
  overall: z.number().min(0).max(10).optional().nullable(),
});

const CritiqueAiSchema = z.object({
  score: RubricScoreSchema,
  critique: z.string(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
});

const ImproveAiSchema = z.object({
  improved: z.string(),
  rationale: z.string().nullable().optional(),
});

const PROJET_RUBRIC = `Tu es un expert Campus France qui évalue le projet d'études d'un étudiant africain francophone candidat au visa étudiant français. Note de 0 à 10 chaque axe :
- coherence: cohérence du parcours (lien études passées → master visé)
- french: niveau et qualité du français écrit
- specificity: spécificité au programme/école choisi (mention de cours, profs, spécialisations)
- returnPlan: solidité du plan de retour au pays d'origine
- overall: note globale
Tu dois aussi fournir une critique en français, des points forts (strengths), des points faibles (weaknesses), et des suggestions d'amélioration concrètes.
Réponds STRICTEMENT en JSON valide selon ce schéma : { "score": { "coherence": n, "french": n, "specificity": n, "returnPlan": n, "overall": n }, "critique": "...", "strengths": ["..."], "weaknesses": ["..."], "suggestions": ["..."] }.`;

const LETTER_RUBRIC = `Tu es un expert Campus France qui évalue la lettre de motivation d'un étudiant pour un voeu Études en France. Note de 0 à 10 chaque axe :
- coherence: lien entre parcours et programme visé
- french: niveau et qualité du français écrit
- specificity: spécificité au programme et à l'école (cours, projets, spécialisations citées)
- returnPlan: lien avec le projet professionnel et de retour
- overall: note globale
Réponds STRICTEMENT en JSON valide : { "score": {...}, "critique": "...", "strengths": [...], "weaknesses": [...], "suggestions": [...] }. Tout en français.`;

async function runCritique(opts: {
  text: string;
  rubric: string;
  feature: string;
  studentId: number;
  userId: number;
  meta?: Record<string, unknown>;
}) {
  if (!isGroqConfigured()) {
    throw new Error("AI not configured");
  }
  const result = await chat({
    ctx: {
      feature: opts.feature,
      userId: opts.userId,
      studentId: opts.studentId,
    },
    messages: [
      { role: "system", content: opts.rubric },
      {
        role: "user",
        content: `Voici le texte à évaluer (entre triples backticks) :\n\`\`\`\n${opts.text}\n\`\`\``,
      },
    ],
    jsonSchema: CritiqueAiSchema,
    temperature: 0.2,
    maxTokens: 1500,
    metadata: (opts.meta ?? undefined) as any,
  });
  return result.content;
}

// ─── PROJET D'ÉTUDES ────────────────────────────────────────────────────────
router.get("/students/:studentId/projet-etudes", requireAuth, async (req, res) => {
  const student = await loadStudentOr403(req, res);
  if (!student) return;
  const [row] = await db
    .select()
    .from(projetEtudesTable)
    .where(eq(projetEtudesTable.studentId, student.id));
  res.json(row ?? null);
});

router.put(
  "/students/:studentId/projet-etudes",
  requireAuth,
  validateBody(UpsertProjetEtudesBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const body = req.body as { content: string; sections?: unknown };
    const wordCount = countWords(body.content ?? "");
    const [existing] = await db
      .select()
      .from(projetEtudesTable)
      .where(eq(projetEtudesTable.studentId, student.id));
    let saved;
    if (existing) {
      [saved] = await db
        .update(projetEtudesTable)
        .set({
          content: body.content ?? "",
          sections: (body.sections ?? null) as any,
          wordCount,
          updatedAt: new Date(),
        })
        .where(eq(projetEtudesTable.id, existing.id))
        .returning();
    } else {
      [saved] = await db
        .insert(projetEtudesTable)
        .values({
          studentId: student.id,
          content: body.content ?? "",
          sections: (body.sections ?? null) as any,
          wordCount,
        })
        .returning();
    }
    res.json(saved);
  },
);

router.get(
  "/students/:studentId/projet-etudes/versions",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const versions = await db
      .select()
      .from(projetEtudesVersionsTable)
      .where(eq(projetEtudesVersionsTable.studentId, student.id))
      .orderBy(desc(projetEtudesVersionsTable.createdAt))
      .limit(50);
    res.json(versions);
  },
);

router.post(
  "/students/:studentId/projet-etudes/versions",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const [projet] = await db
      .select()
      .from(projetEtudesTable)
      .where(eq(projetEtudesTable.studentId, student.id));
    if (!projet) {
      res.status(404).json({ error: "No projet to snapshot" });
      return;
    }
    const [snap] = await db
      .insert(projetEtudesVersionsTable)
      .values({
        projetId: projet.id,
        studentId: student.id,
        content: projet.content,
        sections: projet.sections as any,
        score: projet.latestScore as any,
        critique: projet.lastCritique,
        wordCount: projet.wordCount,
        createdByUserId: req.currentUser!.id,
      })
      .returning();
    res.status(201).json(snap);
  },
);

router.post(
  "/students/:studentId/projet-etudes/critique",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const [projet] = await db
      .select()
      .from(projetEtudesTable)
      .where(eq(projetEtudesTable.studentId, student.id));
    if (!projet || !projet.content || projet.content.trim().length < 50) {
      res.status(400).json({ error: "Le projet d'études doit faire au moins 50 caractères." });
      return;
    }
    if (!isGroqConfigured()) {
      res.status(503).json({ error: "AI non configuré." });
      return;
    }
    try {
      const result = await runCritique({
        text: projet.content,
        rubric: PROJET_RUBRIC,
        feature: "projet_etudes.critique",
        studentId: student.id,
        userId: req.currentUser!.id,
        meta: { projetId: projet.id },
      });
      const now = new Date();
      await db
        .update(projetEtudesTable)
        .set({
          latestScore: result.score as any,
          lastCritique: result.critique,
          lastCritiqueAt: now,
          updatedAt: now,
        })
        .where(eq(projetEtudesTable.id, projet.id));
      await db.insert(projetEtudesVersionsTable).values({
        projetId: projet.id,
        studentId: student.id,
        content: projet.content,
        sections: projet.sections as any,
        score: result.score as any,
        critique: result.critique,
        wordCount: projet.wordCount,
        createdByUserId: req.currentUser!.id,
      });
      await logAudit({
        userId: req.currentUser!.id,
        studentId: student.id,
        action: "projet_etudes.critique",
        entityType: "projet_etudes",
        entityId: projet.id,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "AI error" });
    }
  },
);

router.post(
  "/students/:studentId/projet-etudes/improve",
  requireAuth,
  validateBody(ImproveProjetEtudesParagraphBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const body = req.body as { paragraph: string; instruction?: string | null };
    if (!body.paragraph || body.paragraph.trim().length < 20) {
      res.status(400).json({ error: "Paragraphe trop court." });
      return;
    }
    if (!isGroqConfigured()) {
      res.status(503).json({ error: "AI non configuré." });
      return;
    }
    try {
      const result = await chat({
        ctx: {
          feature: "projet_etudes.improve",
          userId: req.currentUser!.id,
          studentId: student.id,
        },
        messages: [
          {
            role: "system",
            content:
              "Tu es un coach d'écriture pour Campus France. Réécris le paragraphe pour le rendre plus précis, structuré et adapté à un dossier visa étudiant français. Réponds STRICTEMENT en JSON : { \"improved\": \"...\", \"rationale\": \"...\" } en français.",
          },
          {
            role: "user",
            content: `Paragraphe à améliorer :\n\`\`\`\n${body.paragraph}\n\`\`\`\n${body.instruction ? `Consigne : ${body.instruction}` : ""}`,
          },
        ],
        jsonSchema: ImproveAiSchema,
        temperature: 0.3,
        maxTokens: 800,
      });
      res.json(result.content);
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "AI error" });
    }
  },
);

// ─── MOTIVATION LETTERS ─────────────────────────────────────────────────────
async function loadWishOr404(studentId: number, wishId: number, res: any) {
  if (!Number.isInteger(wishId) || wishId <= 0) {
    res.status(400).json({ error: "Invalid wishId" });
    return null;
  }
  const [wish] = await db
    .select()
    .from(eefWishesTable)
    .where(
      and(eq(eefWishesTable.id, wishId), eq(eefWishesTable.studentId, studentId)),
    );
  if (!wish) {
    res.status(404).json({ error: "Wish not found" });
    return null;
  }
  return wish;
}

router.get(
  "/students/:studentId/eef-wishes/:wishId/motivation-letter",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const wish = await loadWishOr404(student.id, Number(req.params.wishId), res);
    if (!wish) return;
    const [row] = await db
      .select()
      .from(motivationLettersTable)
      .where(eq(motivationLettersTable.eefWishId, wish.id));
    res.json(row ?? null);
  },
);

router.put(
  "/students/:studentId/eef-wishes/:wishId/motivation-letter",
  requireAuth,
  validateBody(UpsertMotivationLetterBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const wish = await loadWishOr404(student.id, Number(req.params.wishId), res);
    if (!wish) return;
    const body = req.body as { content: string };
    const wordCount = countWords(body.content ?? "");
    const [existing] = await db
      .select()
      .from(motivationLettersTable)
      .where(eq(motivationLettersTable.eefWishId, wish.id));
    let saved;
    if (existing) {
      [saved] = await db
        .update(motivationLettersTable)
        .set({
          content: body.content ?? "",
          wordCount,
          updatedAt: new Date(),
        })
        .where(eq(motivationLettersTable.id, existing.id))
        .returning();
    } else {
      [saved] = await db
        .insert(motivationLettersTable)
        .values({
          studentId: student.id,
          eefWishId: wish.id,
          content: body.content ?? "",
          wordCount,
        })
        .returning();
    }
    res.json(saved);
  },
);

router.get(
  "/students/:studentId/eef-wishes/:wishId/motivation-letter/versions",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const wish = await loadWishOr404(student.id, Number(req.params.wishId), res);
    if (!wish) return;
    const [letter] = await db
      .select()
      .from(motivationLettersTable)
      .where(eq(motivationLettersTable.eefWishId, wish.id));
    if (!letter) {
      res.json([]);
      return;
    }
    const versions = await db
      .select()
      .from(motivationLetterVersionsTable)
      .where(eq(motivationLetterVersionsTable.letterId, letter.id))
      .orderBy(desc(motivationLetterVersionsTable.createdAt))
      .limit(50);
    res.json(versions);
  },
);

router.post(
  "/students/:studentId/eef-wishes/:wishId/motivation-letter/versions",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const wish = await loadWishOr404(student.id, Number(req.params.wishId), res);
    if (!wish) return;
    const [letter] = await db
      .select()
      .from(motivationLettersTable)
      .where(eq(motivationLettersTable.eefWishId, wish.id));
    if (!letter) {
      res.status(404).json({ error: "No letter to snapshot" });
      return;
    }
    const [snap] = await db
      .insert(motivationLetterVersionsTable)
      .values({
        letterId: letter.id,
        studentId: student.id,
        content: letter.content,
        score: letter.latestScore as any,
        critique: letter.lastCritique,
        wordCount: letter.wordCount,
        createdByUserId: req.currentUser!.id,
      })
      .returning();
    res.status(201).json(snap);
  },
);

router.post(
  "/students/:studentId/eef-wishes/:wishId/motivation-letter/critique",
  requireAuth,
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const wish = await loadWishOr404(student.id, Number(req.params.wishId), res);
    if (!wish) return;
    const [letter] = await db
      .select()
      .from(motivationLettersTable)
      .where(eq(motivationLettersTable.eefWishId, wish.id));
    if (!letter || !letter.content || letter.content.trim().length < 50) {
      res
        .status(400)
        .json({ error: "La lettre de motivation doit faire au moins 50 caractères." });
      return;
    }
    if (!isGroqConfigured()) {
      res.status(503).json({ error: "AI non configuré." });
      return;
    }
    // Add wish context (school + program) so the AI checks specificity correctly
    let schoolName: string | null = wish.schoolNameFreeText ?? null;
    let programName: string | null = wish.programNameFreeText ?? null;
    if (wish.schoolId) {
      const [s] = await db
        .select({ name: schoolsTable.name })
        .from(schoolsTable)
        .where(eq(schoolsTable.id, wish.schoolId));
      if (s?.name) schoolName = s.name;
    }
    if (wish.programId) {
      const [p] = await db
        .select({ name: programsTable.name })
        .from(programsTable)
        .where(eq(programsTable.id, wish.programId));
      if (p?.name) programName = p.name;
    }
    const contextPrefix = `Contexte du voeu : école = ${schoolName ?? "(non précisée)"}, programme = ${programName ?? "(non précisé)"}.\n\n`;
    try {
      const result = await runCritique({
        text: contextPrefix + letter.content,
        rubric: LETTER_RUBRIC,
        feature: "motivation_letter.critique",
        studentId: student.id,
        userId: req.currentUser!.id,
        meta: { letterId: letter.id, wishId: wish.id },
      });
      const now = new Date();
      await db
        .update(motivationLettersTable)
        .set({
          latestScore: result.score as any,
          lastCritique: result.critique,
          lastCritiqueAt: now,
          updatedAt: now,
        })
        .where(eq(motivationLettersTable.id, letter.id));
      await db.insert(motivationLetterVersionsTable).values({
        letterId: letter.id,
        studentId: student.id,
        content: letter.content,
        score: result.score as any,
        critique: result.critique,
        wordCount: letter.wordCount,
        createdByUserId: req.currentUser!.id,
      });
      await logAudit({
        userId: req.currentUser!.id,
        studentId: student.id,
        action: "motivation_letter.critique",
        entityType: "motivation_letter",
        entityId: letter.id,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "AI error" });
    }
  },
);

router.post(
  "/students/:studentId/eef-wishes/:wishId/motivation-letter/improve",
  requireAuth,
  validateBody(ImproveMotivationLetterParagraphBody),
  async (req, res) => {
    const student = await loadStudentOr403(req, res);
    if (!student) return;
    const wish = await loadWishOr404(student.id, Number(req.params.wishId), res);
    if (!wish) return;
    const body = req.body as { paragraph: string; instruction?: string | null };
    if (!body.paragraph || body.paragraph.trim().length < 20) {
      res.status(400).json({ error: "Paragraphe trop court." });
      return;
    }
    if (!isGroqConfigured()) {
      res.status(503).json({ error: "AI non configuré." });
      return;
    }
    try {
      const result = await chat({
        ctx: {
          feature: "motivation_letter.improve",
          userId: req.currentUser!.id,
          studentId: student.id,
        },
        messages: [
          {
            role: "system",
            content:
              "Tu es un coach d'écriture pour les lettres de motivation Études en France. Réécris le paragraphe en français, plus spécifique au programme visé. Réponds en JSON : { \"improved\": \"...\", \"rationale\": \"...\" }.",
          },
          {
            role: "user",
            content: `Paragraphe :\n\`\`\`\n${body.paragraph}\n\`\`\`\n${body.instruction ? `Consigne : ${body.instruction}` : ""}`,
          },
        ],
        jsonSchema: ImproveAiSchema,
        temperature: 0.3,
        maxTokens: 800,
      });
      res.json(result.content);
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "AI error" });
    }
  },
);

export default router;
