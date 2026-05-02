import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { studentsTable } from "./students";
import { usersTable } from "./users";

export const documentStatusEnum = pgEnum("document_status", [
  "missing", "received", "under_review", "validated", "rejected"
]);

export const reviewDecisionEnum = pgEnum("review_decision", ["validated", "rejected"]);

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id),
  reviewedById: integer("reviewed_by_id").references(() => usersTable.id),
  category: text("category").notNull(),
  name: text("name").notNull(),
  fileName: text("file_name").notNull(),
  objectPath: text("object_path").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  status: documentStatusEnum("status").notNull().default("received"),
  version: integer("version").notNull().default(1),
  rejectionReason: text("rejection_reason"),
  reviewedAt: timestamp("reviewed_at"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const documentReviewsTable = pgTable("document_reviews", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documentsTable.id),
  reviewerId: integer("reviewer_id").notNull().references(() => usersTable.id),
  decision: reviewDecisionEnum("decision").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, uploadedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;

export const insertDocumentReviewSchema = createInsertSchema(documentReviewsTable).omit({ id: true, createdAt: true });
export type InsertDocumentReview = z.infer<typeof insertDocumentReviewSchema>;
export type DocumentReview = typeof documentReviewsTable.$inferSelect;
