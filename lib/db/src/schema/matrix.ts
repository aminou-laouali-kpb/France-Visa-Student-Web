import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Per-nationality × per-program-level required-document matrix.
// Each row tells the dossier generator which document categories are
// required for a student of nationality X applying to a programme of
// level Y, plus which visa centre and Campus France procedure apply.
export const documentMatrixEntriesTable = pgTable(
  "document_matrix_entries",
  {
    id: serial("id").primaryKey(),
    nationalityCode: text("nationality_code").notNull(),
    programLevel: text("program_level").notNull(),
    documentCategories: jsonb("document_categories")
      .$type<string[]>()
      .notNull()
      .default([]),
    visaCenter: text("visa_center"),
    campusFranceRequired: boolean("campus_france_required")
      .notNull()
      .default(true),
    notes: text("notes"),
    version: integer("version").notNull().default(1),
    updatedBy: integer("updated_by").references(() => usersTable.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    natLevelUq: uniqueIndex("doc_matrix_nat_level_uq").on(
      t.nationalityCode,
      t.programLevel,
    ),
  }),
);

// Country-keyed intake calendar deadlines. Admins seed these manually;
// the student dashboard surfaces the next ones relevant to the
// student's nationality.
export const intakeCalendarEntriesTable = pgTable(
  "intake_calendar_entries",
  {
    id: serial("id").primaryKey(),
    nationalityCode: text("nationality_code").notNull(),
    label: text("label").notNull(),
    deadlineType: text("deadline_type").notNull(),
    windowStart: text("window_start"),
    windowEnd: text("window_end").notNull(),
    academicYear: text("academic_year"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedBy: integer("updated_by").references(() => usersTable.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const insertDocumentMatrixEntrySchema = createInsertSchema(
  documentMatrixEntriesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
});
export type InsertDocumentMatrixEntry = z.infer<
  typeof insertDocumentMatrixEntrySchema
>;
export type DocumentMatrixEntry =
  typeof documentMatrixEntriesTable.$inferSelect;

export const insertIntakeCalendarEntrySchema = createInsertSchema(
  intakeCalendarEntriesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntakeCalendarEntry = z.infer<
  typeof insertIntakeCalendarEntrySchema
>;
export type IntakeCalendarEntry =
  typeof intakeCalendarEntriesTable.$inferSelect;
