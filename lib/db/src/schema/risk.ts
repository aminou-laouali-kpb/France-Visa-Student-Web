import { pgTable, serial, integer, boolean, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";

export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);

export const riskScoresTable = pgTable("risk_scores", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id).unique(),
  score: integer("score").notNull().default(0),
  level: riskLevelEnum("level").notNull().default("low"),
  missingDocuments: integer("missing_documents").notNull().default(0),
  overdueTasks: integer("overdue_tasks").notNull().default(0),
  rejectedDocuments: integer("rejected_documents").notNull().default(0),
  missingCampusFrance: boolean("missing_campus_france").notNull().default(false),
  missingAppointments: boolean("missing_appointments").notNull().default(false),
  hasVisaRefusal: boolean("has_visa_refusal").notNull().default(false),
  recommendations: jsonb("recommendations").$type<string[]>().notNull().default([]),
  // AI-generated narrative explanation, cached per signals hash. When the
  // hash matches the latest computed signals we can return the cached text
  // without re-billing the model.
  narrativeText: text("narrative_text"),
  narrativeSignalsHash: text("narrative_signals_hash"),
  narrativeUpdatedAt: timestamp("narrative_updated_at"),
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
});

export const insertRiskScoreSchema = createInsertSchema(riskScoresTable).omit({ id: true });
export type InsertRiskScore = z.infer<typeof insertRiskScoreSchema>;
export type RiskScore = typeof riskScoresTable.$inferSelect;
