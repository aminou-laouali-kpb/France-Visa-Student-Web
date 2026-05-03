import { pgTable, serial, integer, text, timestamp, numeric, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { studentsTable } from "./students";

export const aiRunStatusEnum = pgEnum("ai_run_status", ["ok", "error", "over_budget"]);

export const aiRunsTable = pgTable("ai_runs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  userId: integer("user_id").references(() => usersTable.id),
  studentId: integer("student_id").references(() => studentsTable.id),
  feature: text("feature").notNull(),
  model: text("model").notNull(),
  promptHash: text("prompt_hash"),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  audioSeconds: numeric("audio_seconds", { precision: 10, scale: 2 }),
  latencyMs: integer("latency_ms").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
  status: aiRunStatusEnum("status").notNull().default("ok"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  byCreatedAt: index("ai_runs_created_at_idx").on(t.createdAt),
  byTenantCreated: index("ai_runs_tenant_created_idx").on(t.tenantId, t.createdAt),
  byFeature: index("ai_runs_feature_idx").on(t.feature),
}));

export const insertAiRunSchema = createInsertSchema(aiRunsTable).omit({ id: true, createdAt: true });
export type InsertAiRun = z.infer<typeof insertAiRunSchema>;
export type AiRun = typeof aiRunsTable.$inferSelect;
