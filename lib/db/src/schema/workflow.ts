import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { countriesTable } from "./countries";

export const workflowTemplatesTable = pgTable("workflow_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  countryId: integer("country_id").references(() => countriesTable.id),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workflowStepsTable = pgTable("workflow_steps", {
  id: serial("id").primaryKey(),
  workflowTemplateId: integer("workflow_template_id").notNull().references(() => workflowTemplatesTable.id),
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  isCampusFranceStep: boolean("is_campus_france_step").notNull().default(false),
  isRequired: boolean("is_required").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  requiredDocumentCategories: jsonb("required_document_categories").$type<string[]>().notNull().default([]),
});

export const insertWorkflowTemplateSchema = createInsertSchema(workflowTemplatesTable).omit({ id: true, createdAt: true });
export type InsertWorkflowTemplate = z.infer<typeof insertWorkflowTemplateSchema>;
export type WorkflowTemplate = typeof workflowTemplatesTable.$inferSelect;

export const insertWorkflowStepSchema = createInsertSchema(workflowStepsTable).omit({ id: true });
export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;
export type WorkflowStep = typeof workflowStepsTable.$inferSelect;
