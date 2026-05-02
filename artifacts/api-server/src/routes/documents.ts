import { Router, type IRouter } from "express";
import {
  db,
  documentsTable,
  documentReviewsTable,
  studentsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  requireAuth,
  isStaff,
  requireStudentAccess,
  loadAndAuthorizeStudent,
} from "../middlewares/auth";
import { ObjectStorageService } from "../lib/objectStorage";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();
const storage = new ObjectStorageService();

router.get(
  "/students/:studentId/documents",
  requireAuth,
  requireStudentAccess("studentId", "read"),
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const status = req.query.status as string | undefined;
    let docs = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.studentId, studentId))
      .orderBy(desc(documentsTable.uploadedAt));
    if (status) docs = docs.filter((d) => d.status === status);
    res.json(docs);
  },
);

router.post(
  "/students/:studentId/documents",
  requireAuth,
  requireStudentAccess("studentId", "read"),
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const { category, name, fileName, objectPath, mimeType, sizeBytes } = req.body ?? {};
    if (!objectPath || !category || !name) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const existing = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.studentId, studentId), eq(documentsTable.category, category)));
    const version = existing.length + 1;

    const [doc] = await db
      .insert(documentsTable)
      .values({
        studentId,
        uploadedById: req.currentUser!.id,
        category,
        name,
        fileName: fileName ?? name,
        objectPath,
        mimeType: mimeType ?? null,
        sizeBytes: sizeBytes ?? null,
        status: "received",
        version,
      })
      .returning();

    const student = req.targetStudent!;
    const notifyIds = [student.reviewerId, student.advisorId].filter(
      (id): id is number => id !== null && id !== req.currentUser!.id,
    );
    for (const userId of notifyIds) {
      await db.insert(notificationsTable).values({
        userId,
        studentId,
        title: "Nouveau document à examiner",
        message: `${student.firstName} ${student.lastName} a téléversé "${name}"`,
        type: "info",
      });
    }
    await logAudit({
      userId: req.currentUser!.id,
      studentId,
      action: "document.upload",
      entityType: "document",
      entityId: doc.id,
      details: name,
    });
    res.status(201).json(doc);
  },
);

router.get(
  "/students/:studentId/documents/:documentId",
  requireAuth,
  requireStudentAccess("studentId", "read"),
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const id = Number(req.params.documentId);
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, id), eq(documentsTable.studentId, studentId)));
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json(doc);
  },
);

router.patch(
  "/students/:studentId/documents/:documentId",
  requireAuth,
  requireStudentAccess("studentId", "read"),
  async (req, res) => {
    const studentId = Number(req.params.studentId);
    const id = Number(req.params.documentId);
    const [existing] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, id), eq(documentsTable.studentId, studentId)));
    if (!existing) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    if (
      !isStaff(req.currentUser!) &&
      existing.uploadedById !== req.currentUser!.id
    ) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [doc] = await db
      .update(documentsTable)
      .set(req.body ?? {})
      .where(eq(documentsTable.id, id))
      .returning();
    res.json(doc);
  },
);

router.post(
  "/students/:studentId/documents/:documentId/review",
  requireAuth,
  requireStudentAccess("studentId", "read"),
  async (req, res) => {
    if (!isStaff(req.currentUser!)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const studentId = Number(req.params.studentId);
    const documentId = Number(req.params.documentId);
    const [existingDoc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, documentId), eq(documentsTable.studentId, studentId)));
    if (!existingDoc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const { decision, comment } = req.body ?? {};
    if (!["validated", "rejected"].includes(decision)) {
      res.status(400).json({ error: "Invalid decision" });
      return;
    }
    await db.insert(documentReviewsTable).values({
      documentId,
      reviewerId: req.currentUser!.id,
      decision,
      comment: comment ?? null,
    });
    const [updated] = await db
      .update(documentsTable)
      .set({
        status: decision,
        reviewedAt: new Date(),
        reviewedById: req.currentUser!.id,
        rejectionReason: decision === "rejected" ? comment ?? null : null,
      })
      .where(eq(documentsTable.id, documentId))
      .returning();
    const student = req.targetStudent!;
    if (student.userId) {
      await db.insert(notificationsTable).values({
        userId: student.userId,
        studentId,
        title: decision === "validated" ? "Document validé" : "Document rejeté",
        message:
          decision === "validated"
            ? `Votre document "${updated.name}" a été validé.`
            : `Votre document "${updated.name}" a été rejeté. ${comment ?? ""}`,
        type: decision === "rejected" ? "warning" : "success",
      });
    }
    await logAudit({
      userId: req.currentUser!.id,
      studentId,
      action: `document.${decision}`,
      entityType: "document",
      entityId: documentId,
      details: comment,
    });
    res.json(updated);
  },
);

router.post("/storage/upload-url", requireAuth, async (req, res) => {
  try {
    const { name, contentType } = req.body ?? {};
    const uploadURL = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, metadata: { name, contentType } });
  } catch (err) {
    req.log.error({ err }, "upload URL error");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.get("/storage/objects/:objectPath", requireAuth, async (req, res) => {
  res.json({ objectPath: req.params.objectPath });
});

export default router;
