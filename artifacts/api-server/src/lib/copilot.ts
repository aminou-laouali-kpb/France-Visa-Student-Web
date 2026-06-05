import { createHash } from "node:crypto";
import {
  db,
  riskScoresTable,
  studentsTable,
  documentsTable,
  studentStepsTable,
  tasksTable,
  appointmentsTable,
  commentsTable,
  countriesTable,
  schoolsTable,
  programsTable,
  type RiskScore,
  type Student,
} from "@workspace/db";
import { eq, and, desc, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { chat } from "@workspace/ai";

export function hashRiskSignals(r: RiskScore): string {
  const payload = JSON.stringify({
    score: r.score,
    level: r.level,
    missingDocuments: r.missingDocuments,
    overdueTasks: r.overdueTasks,
    rejectedDocuments: r.rejectedDocuments,
    missingCampusFrance: r.missingCampusFrance,
    missingAppointments: r.missingAppointments,
    hasVisaRefusal: r.hasVisaRefusal,
    recommendations: r.recommendations,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

const RiskNarrativeAi = z.object({ narrative: z.string() });

export async function buildRiskNarrative(opts: {
  student: Student;
  risk: RiskScore;
  userId: number;
  tenantId?: number | null;
}): Promise<string> {
  const { student, risk } = opts;
  const facts = [
    `Niveau: ${risk.level} (score ${risk.score}/100).`,
    `Documents manquants: ${risk.missingDocuments}.`,
    `Documents rejetés: ${risk.rejectedDocuments}.`,
    `Tâches en retard: ${risk.overdueTasks}.`,
    risk.missingAppointments
      ? "Rendez-vous TLS/VFS manquant ou hors fenêtre de proximité."
      : null,
    risk.hasVisaRefusal ? "Historique de refus de visa." : null,
    student.intakeDate ? `Rentrée: ${student.intakeDate}.` : null,
  ]
    .filter((s): s is string => !!s)
    .join(" ");

  const result = await chat({
    ctx: {
      feature: "copilot.risk_narrative",
      userId: opts.userId,
      studentId: student.id,
      tenantId: opts.tenantId ?? null,
    },
    messages: [
      {
        role: "system",
        content:
          "Tu es un conseiller visa étudiant pour une admission en école privée française (hors Campus France). Explique en 2 à 3 phrases en français pourquoi le dossier est à risque : lettre d'admission, justificatifs financiers, pièces consulaires, rendez-vous TLS/VFS. Ne mentionne JAMAIS le score numérique ni Campus France. Termine par une action prioritaire. Réponds STRICTEMENT en JSON: {\"narrative\":\"...\"}.",
      },
      {
        role: "user",
        content: `Étudiant: ${student.firstName} ${student.lastName}.\nFacteurs: ${facts}\nRecommandations système: ${(risk.recommendations || []).join(" / ")}`,
      },
    ],
    jsonSchema: RiskNarrativeAi,
    temperature: 0.3,
    maxTokens: 350,
  });
  return result.content.narrative.trim();
}

export interface CopilotSummary {
  missing: string[];
  risky: string[];
  changed: string[];
  draftReply: string;
  correctionRequest: string;
  promptHash: string;
}

const CopilotAi = z.object({
  missing: z.array(z.string()).default([]),
  risky: z.array(z.string()).default([]),
  changed: z.array(z.string()).default([]),
  draftReply: z.string(),
  correctionRequest: z.string(),
});

interface DossierContext {
  student: Student;
  countryName: string | null;
  schoolName: string | null;
  programName: string | null;
  risk: RiskScore | null;
  steps: { name: string; status: string; isCampusFranceStep: boolean }[];
  documents: { name: string; status: string; updatedAt: string | null }[];
  overdueTasks: { title: string; dueDate: string | null }[];
  upcomingAppointments: { type: string; title: string; scheduledAt: string }[];
  recentComments: { author: string; content: string; createdAt: string }[];
  recentActivity: string;
}

export async function loadDossierContext(studentId: number): Promise<DossierContext | null> {
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  if (!student) return null;
  const country = student.countryId
    ? (await db.select().from(countriesTable).where(eq(countriesTable.id, student.countryId)))[0]
    : null;
  const school = student.schoolId
    ? (await db.select().from(schoolsTable).where(eq(schoolsTable.id, student.schoolId)))[0]
    : null;
  const program = student.programId
    ? (await db.select().from(programsTable).where(eq(programsTable.id, student.programId)))[0]
    : null;
  const [risk] = await db
    .select()
    .from(riskScoresTable)
    .where(eq(riskScoresTable.studentId, studentId));
  const steps = await db
    .select()
    .from(studentStepsTable)
    .where(eq(studentStepsTable.studentId, studentId));
  const docs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.studentId, studentId));
  const overdue = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.studentId, studentId),
        lt(tasksTable.dueDate, new Date()),
        ne(tasksTable.status, "done"),
      ),
    );
  const apts = await db
    .select()
    .from(appointmentsTable)
    .where(and(eq(appointmentsTable.studentId, studentId), eq(appointmentsTable.status, "upcoming")));
  const recent = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.studentId, studentId))
    .orderBy(desc(commentsTable.createdAt))
    .limit(6);
  const lastReview = recent
    .filter((c) => c.isCorrectionRequest)
    .map((c) => c.createdAt)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const changedDocs = lastReview
    ? docs.filter((d) => d.uploadedAt && d.uploadedAt.getTime() > lastReview.getTime())
    : [];
  const recentActivityBits: string[] = [];
  if (lastReview) recentActivityBits.push(`Dernière revue: ${lastReview.toISOString().slice(0, 10)}.`);
  if (changedDocs.length > 0) {
    recentActivityBits.push(
      `Documents ré-uploadés depuis: ${changedDocs.map((d) => d.name).join(", ")}.`,
    );
  }

  return {
    student,
    countryName: country?.name ?? null,
    schoolName: school?.name ?? null,
    programName: program?.name ?? null,
    risk: risk ?? null,
    steps: steps
      .filter((s) => !s.isCampusFranceStep)
      .map((s) => ({
        name: s.stepName,
        status: s.status,
        isCampusFranceStep: false,
      })),
    documents: docs.map((d) => ({
      name: d.name,
      status: d.status,
      updatedAt: d.uploadedAt ? d.uploadedAt.toISOString() : null,
    })),
    overdueTasks: overdue.map((t) => ({
      title: t.title,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    })),
    upcomingAppointments: apts.map((a) => ({
      type: a.type,
      title: a.title,
      scheduledAt: a.scheduledAt.toISOString(),
    })),
    recentComments: recent.map((c) => ({
      author: String(c.authorId),
      content: c.content.slice(0, 240),
      createdAt: c.createdAt.toISOString(),
    })),
    recentActivity: recentActivityBits.join(" "),
  };
}

export async function buildCopilotSummary(opts: {
  ctx: DossierContext;
  userId: number;
  tenantId?: number | null;
}): Promise<CopilotSummary> {
  const { ctx } = opts;
  const factsJson = JSON.stringify({
    student: {
      name: `${ctx.student.firstName} ${ctx.student.lastName}`,
      country: ctx.countryName,
      school: ctx.schoolName,
      program: ctx.programName,
      status: ctx.student.status,
      intakeDate: ctx.student.intakeDate,
    },
    risk: ctx.risk
      ? {
          level: ctx.risk.level,
          missingDocuments: ctx.risk.missingDocuments,
          rejectedDocuments: ctx.risk.rejectedDocuments,
          missingTlsAppointment: ctx.risk.missingAppointments,
          recommendations: ctx.risk.recommendations,
        }
      : null,
    documents: ctx.documents,
    overdueTasks: ctx.overdueTasks,
    upcomingAppointments: ctx.upcomingAppointments,
    steps: ctx.steps,
    recentActivity: ctx.recentActivity || "(aucun changement récent détecté)",
  });
  const promptHash = createHash("sha256").update(factsJson).digest("hex").slice(0, 32);
  const result = await chat({
    ctx: {
      feature: "copilot.summary",
      userId: opts.userId,
      studentId: ctx.student.id,
      tenantId: opts.tenantId ?? null,
    },
    messages: [
      {
        role: "system",
        content:
          "Tu es l'assistant IA d'un conseiller visa pour étudiants admis en école privée française (procédure consulaire TLS/VFS, sans Campus France). À partir de l'état du dossier, produis: (a) `missing` — pièces ou actions manquantes (lettre d'admission, finances, passeport, etc.; max 5, courtes), (b) `risky` — points de vigilance (max 5), (c) `changed` — ce qui a bougé depuis la dernière revue (max 4), (d) `draftReply` — message bref et cordial en français à l'étudiant (max 6 lignes), (e) `correctionRequest` — demande de correction précise (max 6 lignes). Ne cite pas Campus France ni les vœux Études en France. Réponds STRICTEMENT en JSON: {\"missing\":[],\"risky\":[],\"changed\":[],\"draftReply\":\"...\",\"correctionRequest\":\"...\"}.",
      },
      { role: "user", content: factsJson },
    ],
    jsonSchema: CopilotAi,
    temperature: 0.3,
    maxTokens: 1200,
  });
  return {
    missing: result.content.missing ?? [],
    risky: result.content.risky ?? [],
    changed: result.content.changed ?? [],
    draftReply: result.content.draftReply,
    correctionRequest: result.content.correctionRequest,
    promptHash,
  };
}
