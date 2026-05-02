import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { countriesTable } from "./countries";
import { schoolsTable, programsTable } from "./schools";
import { workflowStepsTable } from "./workflow";

export const studentStatusEnum = pgEnum("student_status", [
  "prospect", "active", "blocked", "submitted", "visa_obtained", "visa_refused", "withdrawn"
]);

export const stepStatusEnum = pgEnum("step_status", [
  "not_started", "in_progress", "submitted", "under_review", "blocked", "validated", "rejected"
]);

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  advisorId: integer("advisor_id").references(() => usersTable.id),
  reviewerId: integer("reviewer_id").references(() => usersTable.id),
  countryId: integer("country_id").references(() => countriesTable.id),
  schoolId: integer("school_id").references(() => schoolsTable.id),
  programId: integer("program_id").references(() => programsTable.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  gender: text("gender"),
  dateOfBirth: text("date_of_birth"),
  nationalityCode: text("nationality_code"),
  passportNumber: text("passport_number"),
  passportExpiry: text("passport_expiry"),
  financingType: text("financing_type"),
  hasVisaRefusalHistory: boolean("has_visa_refusal_history").notNull().default(false),
  intakeDate: text("intake_date"),
  status: studentStatusEnum("status").notNull().default("active"),
  completionScore: integer("completion_score").notNull().default(0),
  lastActivityAt: timestamp("last_activity_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const studentStepsTable = pgTable("student_steps", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  workflowStepId: integer("workflow_step_id").notNull().references(() => workflowStepsTable.id),
  stepName: text("step_name").notNull(),
  stepOrder: integer("step_order").notNull(),
  isCampusFranceStep: boolean("is_campus_france_step").notNull().default(false),
  isRequired: boolean("is_required").notNull().default(true),
  status: stepStatusEnum("status").notNull().default("not_started"),
  completedAt: timestamp("completed_at"),
  blockedReason: text("blocked_reason"),
  overrideJustification: text("override_justification"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const checklistItemsTable = pgTable("checklist_items", {
  id: serial("id").primaryKey(),
  workflowStepId: integer("workflow_step_id").notNull().references(() => workflowStepsTable.id),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  label: text("label").notNull(),
  isRequired: boolean("is_required").notNull().default(true),
  isChecked: boolean("is_checked").notNull().default(false),
  checkedAt: timestamp("checked_at"),
  checkedBy: integer("checked_by").references(() => usersTable.id),
  order: integer("order").notNull().default(0),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true, updatedAt: true, completionScore: true, lastActivityAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;

export const insertStudentStepSchema = createInsertSchema(studentStepsTable).omit({ id: true });
export type InsertStudentStep = z.infer<typeof insertStudentStepSchema>;
export type StudentStep = typeof studentStepsTable.$inferSelect;

export const insertChecklistItemSchema = createInsertSchema(checklistItemsTable).omit({ id: true });
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type ChecklistItem = typeof checklistItemsTable.$inferSelect;
