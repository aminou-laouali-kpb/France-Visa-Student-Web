import { pgTable, serial, text, integer, boolean, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
export const PLAYBOOK_PHASES = ["admission", "entretien", "tls", "refus"] as const;
export type PlaybookPhase = (typeof PLAYBOOK_PHASES)[number];
export const playbooksTable = pgTable("playbooks", {
  id: serial("id").primaryKey(), slug: text("slug").notNull(), title: text("title").notNull(),
  description: text("description"), phase: text("phase").notNull().$type<PlaybookPhase>(),
  isActive: boolean("is_active").notNull().default(true), sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(), updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ slugUq: uniqueIndex("playbooks_slug_uq").on(t.slug) }));
export const playbookStepsTable = pgTable("playbook_steps", {
  id: serial("id").primaryKey(),
  playbookId: integer("playbook_id").notNull().references(() => playbooksTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(), body: text("body").notNull(), sortOrder: integer("sort_order").notNull().default(0),
  checklist: jsonb("checklist").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(), updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertPlaybookSchema = createInsertSchema(playbooksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlaybook = z.infer<typeof insertPlaybookSchema>;
export type Playbook = typeof playbooksTable.$inferSelect;
export const insertPlaybookStepSchema = createInsertSchema(playbookStepsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlaybookStep = z.infer<typeof insertPlaybookStepSchema>;
export type PlaybookStepRow = typeof playbookStepsTable.$inferSelect;
