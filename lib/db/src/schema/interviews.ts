import { pgTable, serial, integer, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { usersTable } from "./users";

export const interviewModeEnum = pgEnum("interview_mode", ["text", "voice"]);
export const interviewStatusEnum = pgEnum("interview_status", [
  "in_progress",
  "completed",
  "abandoned",
]);
export const interviewTurnRoleEnum = pgEnum("interview_turn_role", [
  "interviewer",
  "student",
]);

export interface InterviewRubric {
  motivation?: number;
  coherence?: number;
  french?: number;
  knowledge?: number;
  returnPlan?: number;
  overall?: number;
}

export const interviewsTable = pgTable("interviews", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  mode: interviewModeEnum("mode").notNull().default("text"),
  status: interviewStatusEnum("status").notNull().default("in_progress"),
  // Snapshot of the program/school/country at start so reports remain stable
  // even when the student profile is later updated.
  programName: text("program_name"),
  schoolName: text("school_name"),
  countryName: text("country_name"),
  language: text("language").notNull().default("fr"),
  score: jsonb("score").$type<InterviewRubric>(),
  feedback: text("feedback"),
  strengths: jsonb("strengths").$type<string[]>(),
  weaknesses: jsonb("weaknesses").$type<string[]>(),
  suggestions: jsonb("suggestions").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const interviewTurnsTable = pgTable("interview_turns", {
  id: serial("id").primaryKey(),
  interviewId: integer("interview_id").notNull().references(() => interviewsTable.id, { onDelete: "cascade" }),
  turnIndex: integer("turn_index").notNull(),
  role: interviewTurnRoleEnum("role").notNull(),
  content: text("content").notNull(),
  audioPath: text("audio_path"),
  transcription: text("transcription"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const copilotFeedbackTable = pgTable("copilot_feedback", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  feature: text("feature").notNull(),
  vote: text("vote").notNull(),
  comment: text("comment"),
  promptHash: text("prompt_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInterviewSchema = createInsertSchema(interviewsTable).omit({ id: true, createdAt: true });
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type Interview = typeof interviewsTable.$inferSelect;

export const insertInterviewTurnSchema = createInsertSchema(interviewTurnsTable).omit({ id: true, createdAt: true });
export type InsertInterviewTurn = z.infer<typeof insertInterviewTurnSchema>;
export type InterviewTurn = typeof interviewTurnsTable.$inferSelect;

export const insertCopilotFeedbackSchema = createInsertSchema(copilotFeedbackTable).omit({ id: true, createdAt: true });
export type InsertCopilotFeedback = z.infer<typeof insertCopilotFeedbackSchema>;
export type CopilotFeedback = typeof copilotFeedbackTable.$inferSelect;
