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
    const isUploader = existing.uploadedById === req.currentUser!.id;
    if (!isStaff(req.currentUser!) && !isUploader) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    // Whitelist allowed fields per role; review fields go through /review only.
    const body = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (isStaff(req.currentUser!)) {
      if (body.name !== undefined) patch.name = body.name;
      if (body.category !== undefined) patch.category = body.category;
      if (body.status !== undefined && ["received", "under_review"].includes(body.status)) {
        patch.status = body.status;
      }
    } else {
      if (body.name !== undefined) patch.name = body.name;
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No updatable fields provided" });
      return;
    }
    const [doc] = await db
      .update(documentsTable)
      .set(patch)
      .where(and(eq(documentsTable.id, id), eq(documentsTable.studentId, studentId)))
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
    if (decision === "rejected" && (!comment || String(comment).trim().length < 3)) {
      res.status(400).json({ error: "A rejection reason (comment) is required" });
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

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

router.post("/storage/upload-url", requireAuth, async (req, res) => {
  try {
    const { name, contentType, sizeBytes } = req.body ?? {};
    if (contentType && !ALLOWED_MIME_TYPES.includes(contentType)) {
      res.status(400).json({
        error: `Unsupported file type: ${contentType}. Allowed: PDF, JPEG, PNG, WEBP, HEIC, DOC, DOCX.`,
      });
      return;
    }
    if (typeof sizeBytes === "number" && sizeBytes > MAX_UPLOAD_BYTES) {
      res.status(400).json({
        error: `File too large: ${sizeBytes} bytes (max ${MAX_UPLOAD_BYTES}).`,
      });
      return;
    }
    const uploadURL = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, metadata: { name, contentType } });
  } catch (err) {
    req.log.error({ err }, "upload URL error");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// Secure signed download — only users who can access the parent student may stream the file.
router.get("/storage/objects/*splat", requireAuth, async (req, res) => {
  try {
    const splat = (req.params as Record<string, string | string[]>).splat;
    const tail = Array.isArray(splat) ? splat.join("/") : String(splat ?? "");
    const fullObjectPath = `/objects/${tail}`;
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.objectPath, fullObjectPath));
    if (!doc) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    const [student] = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.id, doc.studentId));
    if (!student) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    const { canAccessStudent } = await import("../middlewares/auth");
    if (!canAccessStudent(req.currentUser!, student)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const file = await storage.getObjectEntityFile(fullObjectPath);
    const response = await storage.downloadObject(file, 60);
    response.headers.forEach((v, k) => res.setHeader(k, v));
    if (!response.body) {
      res.status(404).end();
      return;
    }
    const reader = response.body.getReader();
    res.status(response.status);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    req.log.error({ err }, "object download error");
    res.status(404).json({ error: "Object not found" });
  }
});

export default router;
