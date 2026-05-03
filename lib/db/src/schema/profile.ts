import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  numeric,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { schoolsTable, programsTable } from "./schools";

export const maritalStatusEnum = pgEnum("marital_status", [
  "single",
  "married",
  "divorced",
  "widowed",
  "other",
]);

export const languageTestTypeEnum = pgEnum("language_test_type", [
  "TCF",
  "TCF_DAP",
  "TCF_TP",
  "TCF_QUEBEC",
  "TEF",
  "TEFAQ",
  "DELF",
  "DALF",
  "DILF",
  "IELTS",
  "TOEFL",
  "OTHER",
]);

export const languageLevelEnum = pgEnum("language_level", [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
]);

export const eefWishStatusEnum = pgEnum("eef_wish_status", [
  "draft",
  "submitted",
  "accepted",
  "refused",
  "waitlist",
  "withdrawn",
]);

export const diplomaEquivalenceStatusEnum = pgEnum("diploma_equivalence_status", [
  "not_requested",
  "requested",
  "received",
  "not_required",
]);

// ── Civil status (1:1 with student) ─────────────────────────────────────────
export const studentCivilStatusTable = pgTable(
  "student_civil_status",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    maritalStatus: maritalStatusEnum("marital_status"),
    birthCity: text("birth_city"),
    birthCountryCode: text("birth_country_code"),
    addressLine: text("address_line"),
    postalCode: text("postal_code"),
    city: text("city"),
    countryCode: text("country_code"),
    fatherFirstName: text("father_first_name"),
    fatherLastName: text("father_last_name"),
    fatherProfession: text("father_profession"),
    motherFirstName: text("mother_first_name"),
    motherLastName: text("mother_last_name"),
    motherProfession: text("mother_profession"),
    numberOfSiblings: integer("number_of_siblings"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqStudent: uniqueIndex("student_civil_status_student_uniq").on(t.studentId),
  }),
);

// ── Prior schooling timeline (last 5 years) ─────────────────────────────────
export const priorSchoolingEntriesTable = pgTable(
  "prior_schooling_entries",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    startYear: integer("start_year"),
    endYear: integer("end_year"),
    institutionName: text("institution_name").notNull(),
    diplomaOrLevel: text("diploma_or_level"),
    countryCode: text("country_code"),
    city: text("city"),
    mainSubjects: text("main_subjects"),
    finalGrade: text("final_grade"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    byStudent: index("prior_schooling_student_idx").on(t.studentId),
  }),
);

// ── Language tests (TCF / TEF / DELF / DALF / etc.) ─────────────────────────
export const languageTestsTable = pgTable(
  "language_tests",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    testType: languageTestTypeEnum("test_type").notNull(),
    language: text("language").notNull().default("french"),
    overallScore: numeric("overall_score", { precision: 6, scale: 2 }),
    level: languageLevelEnum("level"),
    comprehensionOral: numeric("comprehension_oral", { precision: 6, scale: 2 }),
    comprehensionEcrite: numeric("comprehension_ecrite", { precision: 6, scale: 2 }),
    expressionOrale: numeric("expression_orale", { precision: 6, scale: 2 }),
    expressionEcrite: numeric("expression_ecrite", { precision: 6, scale: 2 }),
    testDate: text("test_date"),
    expiryDate: text("expiry_date"),
    certificateDocumentId: integer("certificate_document_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    byStudent: index("language_tests_student_idx").on(t.studentId),
    byExpiry: index("language_tests_expiry_idx").on(t.expiryDate),
  }),
);

// ── Diploma equivalence (ENIC-NARIC etc.) ───────────────────────────────────
export const diplomaEquivalencesTable = pgTable(
  "diploma_equivalences",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    originalDiploma: text("original_diploma").notNull(),
    originalCountryCode: text("original_country_code"),
    equivalentLevel: text("equivalent_level"),
    enicNaricRef: text("enic_naric_ref"),
    status: diplomaEquivalenceStatusEnum("status").notNull().default("not_requested"),
    requestedAt: text("requested_at"),
    decisionAt: text("decision_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    byStudent: index("diploma_equivalences_student_idx").on(t.studentId),
  }),
);

// ── EEF wishes (up to 7 voeux on Études en France) ──────────────────────────
export const eefWishesTable = pgTable(
  "eef_wishes",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    wishOrder: integer("wish_order").notNull(),
    schoolId: integer("school_id").references(() => schoolsTable.id),
    programId: integer("program_id").references(() => programsTable.id),
    schoolNameFreeText: text("school_name_free_text"),
    programNameFreeText: text("program_name_free_text"),
    motivationText: text("motivation_text"),
    status: eefWishStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    byStudent: index("eef_wishes_student_idx").on(t.studentId),
    uniqStudentOrder: uniqueIndex("eef_wishes_student_order_uniq").on(
      t.studentId,
      t.wishOrder,
    ),
  }),
);

// ── Inferred types & insert schemas ─────────────────────────────────────────
export const insertStudentCivilStatusSchema = createInsertSchema(
  studentCivilStatusTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudentCivilStatus = z.infer<typeof insertStudentCivilStatusSchema>;
export type StudentCivilStatus = typeof studentCivilStatusTable.$inferSelect;

export const insertPriorSchoolingEntrySchema = createInsertSchema(
  priorSchoolingEntriesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPriorSchoolingEntry = z.infer<typeof insertPriorSchoolingEntrySchema>;
export type PriorSchoolingEntry = typeof priorSchoolingEntriesTable.$inferSelect;

export const insertLanguageTestSchema = createInsertSchema(languageTestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLanguageTest = z.infer<typeof insertLanguageTestSchema>;
export type LanguageTest = typeof languageTestsTable.$inferSelect;

export const insertDiplomaEquivalenceSchema = createInsertSchema(
  diplomaEquivalencesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDiplomaEquivalence = z.infer<typeof insertDiplomaEquivalenceSchema>;
export type DiplomaEquivalence = typeof diplomaEquivalencesTable.$inferSelect;

export const insertEefWishSchema = createInsertSchema(eefWishesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEefWish = z.infer<typeof insertEefWishSchema>;
export type EefWish = typeof eefWishesTable.$inferSelect;
