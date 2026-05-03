import { Router, type IRouter } from "express";
import PDFDocument from "pdfkit";
import {
  db,
  studentsTable,
  studentStepsTable,
  documentsTable,
  appointmentsTable,
  postArrivalStepsTable,
  riskScoresTable,
  countriesTable,
  schoolsTable,
  programsTable,
  usersTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, canAccessStudent } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/students/:studentId/dossier.pdf", requireAuth, async (req, res) => {
  const id = Number(req.params.studentId);
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) {
    res.status(404).send("not_found");
    return;
  }
  if (!canAccessStudent(req.currentUser!, student)) {
    res.status(403).send("forbidden");
    return;
  }

  const [country] = student.countryId
    ? await db.select().from(countriesTable).where(eq(countriesTable.id, student.countryId))
    : [undefined];
  const [school] = student.schoolId
    ? await db.select().from(schoolsTable).where(eq(schoolsTable.id, student.schoolId))
    : [undefined];
  const [program] = student.programId
    ? await db.select().from(programsTable).where(eq(programsTable.id, student.programId))
    : [undefined];
  const [advisor] = student.advisorId
    ? await db.select().from(usersTable).where(eq(usersTable.id, student.advisorId))
    : [undefined];
  const steps = await db
    .select()
    .from(studentStepsTable)
    .where(eq(studentStepsTable.studentId, id))
    .orderBy(studentStepsTable.stepOrder);
  const docs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.studentId, id))
    .orderBy(documentsTable.id);
  const appts = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.studentId, id))
    .orderBy(appointmentsTable.scheduledAt);
  const paSteps = await db
    .select()
    .from(postArrivalStepsTable)
    .where(eq(postArrivalStepsTable.studentId, id))
    .orderBy(postArrivalStepsTable.order);
  const [risk] = await db
    .select()
    .from(riskScoresTable)
    .where(eq(riskScoresTable.studentId, id))
    .orderBy(desc(riskScoresTable.calculatedAt))
    .limit(1);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="dossier-${student.lastName}-${student.firstName}-${id}.pdf"`,
  );
  doc.pipe(res);
  doc.on("error", (err) => logger.warn({ err, studentId: id }, "pdf stream error"));

  // Header
  doc.fontSize(20).text("VisaFlow — Dossier étudiant", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#666").text(
    `Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`,
    { align: "center" },
  );
  doc.moveDown();
  doc.fillColor("#000");

  // Table of contents — section + (estimated) page anchor.
  doc.fontSize(14).text("Sommaire", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(11);
  const toc: Array<{ title: string; count?: number }> = [
    { title: "1. Identité" },
    ...(risk ? [{ title: "2. Évaluation des risques" }] : []),
    { title: `${risk ? "3" : "2"}. Étapes du dossier`, count: steps.length },
    { title: `${risk ? "4" : "3"}. Documents`, count: docs.length },
    { title: `${risk ? "5" : "4"}. Rendez-vous`, count: appts.length },
    ...(paSteps.length > 0
      ? [{ title: `${risk ? "6" : "5"}. Post-arrivée`, count: paSteps.length }]
      : []),
  ];
  for (const t of toc) {
    doc.font("Helvetica").text(
      t.count !== undefined ? `${t.title}  (${t.count})` : t.title,
    );
  }
  doc.moveDown();
  doc.addPage();

  // Identity
  doc.fontSize(14).text("Identité", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(11);
  const lines: Array<[string, string | null | undefined]> = [
    ["Nom", student.lastName],
    ["Prénom", student.firstName],
    ["Email", student.email],
    ["Téléphone", student.phone],
    ["WhatsApp", student.whatsapp],
    ["Date de naissance", student.dateOfBirth],
    ["Nationalité", country?.name ?? student.nationalityCode],
    ["Passeport", student.passportNumber],
    ["Expiration passeport", student.passportExpiry],
    ["Statut", student.status],
    ["Conseiller", advisor ? `${advisor.firstName} ${advisor.lastName}` : "—"],
    ["École", school?.name],
    ["Programme", program?.name],
    ["Date de rentrée", student.intakeDate],
    ["Type de visa", student.visaType],
    ["Date d'arrivée prévue", student.arrivalDate],
    ["Expiration titre de séjour", student.titreExpiryDate],
  ];
  for (const [k, v] of lines) {
    if (v == null || v === "") continue;
    doc.font("Helvetica-Bold").text(`${k}: `, { continued: true });
    doc.font("Helvetica").text(String(v));
  }
  doc.moveDown();

  // Risk
  if (risk) {
    doc.fontSize(14).text("Évaluation des risques", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11);
    doc.font("Helvetica-Bold").text("Score: ", { continued: true });
    doc.font("Helvetica").text(`${risk.score} / ${risk.level}`);
    if (Array.isArray(risk.recommendations) && risk.recommendations.length > 0) {
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10).fillColor("#444");
      for (const r of risk.recommendations) doc.text(`• ${r}`);
      doc.fillColor("#000").fontSize(11);
    }
    doc.moveDown();
  }

  // Workflow steps
  doc.fontSize(14).text("Étapes du dossier", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10);
  if (steps.length === 0) {
    doc.fillColor("#888").text("Aucune étape").fillColor("#000");
  } else {
    for (const s of steps) {
      doc.font("Helvetica-Bold").text(`${s.stepOrder + 1}. ${s.stepName}`, { continued: true });
      doc.font("Helvetica").fillColor("#666").text(`  [${s.status}]`).fillColor("#000");
      if (s.notes) {
        doc.fontSize(9).fillColor("#444").text(`   ${s.notes}`).fillColor("#000").fontSize(10);
      }
    }
  }
  doc.moveDown();

  // Documents — grouped by category for embassy-friendly ordering, with
  // status, version, and uploader info. Binary attachments are referenced
  // by URL rather than embedded so the PDF stays a single small file.
  doc.fontSize(14).text("Documents", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10);
  if (docs.length === 0) {
    doc.fillColor("#888").text("Aucun document").fillColor("#000");
  } else {
    const byCategory = new Map<string, typeof docs>();
    for (const d of docs) {
      const k = d.category ?? "(non classé)";
      if (!byCategory.has(k)) byCategory.set(k, [] as typeof docs);
      byCategory.get(k)!.push(d);
    }
    for (const [cat, group] of [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      doc.font("Helvetica-Bold").fontSize(11).text(cat);
      doc.fontSize(10);
      for (const d of group) {
        doc.font("Helvetica-Bold").text(`  • ${d.fileName ?? "document"}`, { continued: true });
        doc.font("Helvetica").fillColor("#666").text(`  [${d.status}]`).fillColor("#000");
        if (d.objectPath) {
          doc.fontSize(9).fillColor("#444").text(`     Référence: ${d.objectPath}`).fillColor("#000").fontSize(10);
        }
      }
      doc.moveDown(0.3);
    }
  }
  doc.moveDown();

  // Appointments
  doc.fontSize(14).text("Rendez-vous", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10);
  if (appts.length === 0) {
    doc.fillColor("#888").text("Aucun rendez-vous").fillColor("#000");
  } else {
    for (const a of appts) {
      const when = new Date(a.scheduledAt).toLocaleString("fr-FR");
      doc.font("Helvetica-Bold").text(`${when} — ${a.title}`);
      doc.font("Helvetica").fontSize(9).fillColor("#444")
        .text(`   Type: ${a.type} • Statut: ${a.status}${a.location ? ` • Lieu: ${a.location}` : ""}`)
        .fillColor("#000").fontSize(10);
    }
  }
  doc.moveDown();

  // Post-arrival
  if (paSteps.length > 0) {
    doc.fontSize(14).text("Post-arrivée", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    for (const s of paSteps) {
      doc.font("Helvetica-Bold").text(`• ${s.label}`, { continued: true });
      doc.font("Helvetica").fillColor("#666").text(`  [${s.status}]`).fillColor("#000");
      if (s.dueDate) doc.fontSize(9).fillColor("#444").text(`   Échéance: ${s.dueDate}`).fillColor("#000").fontSize(10);
    }
    doc.moveDown();
  }

  doc.fontSize(8).fillColor("#888").text(
    "Document généré automatiquement par VisaFlow. Confidentiel — diffusion limitée à l'étudiant et à son conseiller.",
    { align: "center" },
  );

  doc.end();
});

export default router;
