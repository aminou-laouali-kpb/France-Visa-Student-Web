import { pgTable, serial, text, integer, boolean, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tenantsTable } from "./tenants";
import { countriesTable } from "./countries";
import { schoolsTable, programsTable } from "./schools";
import { workflowStepsTable } from "./workflow";

export const studentStatusEnum = pgEnum("student_status", [
  "prospect", "active", "blocked", "submitted", "visa_obtained", "visa_refused", "withdrawn"
]);

export const stepStatusEnum = pgEnum("step_status", [
  "not_started", "in_progress", "submitted", "under_review", "blocked", "validated", "rejected"
]);

// VLS-TS: visa long séjour valant titre de séjour (>3 month stays, the default
// for most degree programs). VLS-T: visa long séjour temporaire (3–12 month
// non-renewable stays, e.g. language schools, exchange semesters). The two
// downstream workflows differ — only VLS-TS holders must validate via ANEF
// within 3 months of arrival.
export const visaTypeEnum = pgEnum("visa_type", ["vls_ts", "vls_t"]);

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  // Tenant scope. Nullable during backfill — every new student must be
  // tied to a tenant.
  tenantId: integer("tenant_id").references(() => tenantsTable.id),
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
  programEndDate: text("program_end_date"),
  monthlyMinimumEur: integer("monthly_minimum_eur"),
  // Visa type drives the post-arrival workflow (VLS-TS gets ANEF validation
  // and titre renewal; VLS-T does not).
  visaType: visaTypeEnum("visa_type"),
  // Planned arrival in France (drives 14/7/1d pre-arrival reminders).
  arrivalDate: text("arrival_date"),
  // Expiry of the current titre de séjour (drives 60d pre-renewal reminder).
  titreExpiryDate: text("titre_expiry_date"),
  submissionGateOverride: boolean("submission_gate_override").notNull().default(false),
  submissionGateOverrideReason: text("submission_gate_override_reason"),
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

// Post-arrival workflow steps mirrored on the student-steps pattern.
// Generated when the student transitions to "visa_obtained" — the dossier
// is far from over: ANEF VLS-TS validation, OFII medical, CAF, Sécu
// étudiante, bank account, and the titre-de-séjour renewal must be
// tracked individually with status, due dates and notes.
export const postArrivalStepsTable = pgTable(
  "post_arrival_steps",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull().references(() => studentsTable.id),
    // Stable code (anef_validation, ofii_medical, caf, secu_etudiante, bank,
    // titre_renewal, …) so reminders / business rules can target a step
    // without depending on a translatable label.
    code: text("code").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    status: stepStatusEnum("status").notNull().default("not_started"),
    dueDate: text("due_date"),
    completedAt: timestamp("completed_at"),
    notes: text("notes"),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    // (student, code) is the natural key — a student can never have two
    // rows for the same workflow step. Backs concurrency-safe upserts in
    // provisionPostArrivalSteps via onConflictDoNothing.
    studentCodeUq: uniqueIndex("post_arrival_student_code_uq").on(
      t.studentId,
      t.code,
    ),
  }),
);

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true, updatedAt: true, completionScore: true, lastActivityAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;

export const insertStudentStepSchema = createInsertSchema(studentStepsTable).omit({ id: true });
export type InsertStudentStep = z.infer<typeof insertStudentStepSchema>;
export type StudentStep = typeof studentStepsTable.$inferSelect;

export const insertChecklistItemSchema = createInsertSchema(checklistItemsTable).omit({ id: true });
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type ChecklistItem = typeof checklistItemsTable.$inferSelect;

export const insertPostArrivalStepSchema = createInsertSchema(postArrivalStepsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPostArrivalStep = z.infer<typeof insertPostArrivalStepSchema>;
export type PostArrivalStep = typeof postArrivalStepsTable.$inferSelect;
