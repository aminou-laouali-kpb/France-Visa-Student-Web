import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { usersTable } from "./users";

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  content: text("content").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  isCorrectionRequest: boolean("is_correction_request").notNull().default(false),
  // Detected source language of `content` (e.g. 'fr', 'wo', 'ln', 'ar', 'en').
  originalLanguage: text("original_language"),
  // AI-translated mirror of `content` (target depends on the recipient's
  // preferred language: students see content in their language, advisors
  // always see French). Stored alongside the original — never replaces it.
  translatedContent: text("translated_content"),
  translatedToLanguage: text("translated_to_language"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;
