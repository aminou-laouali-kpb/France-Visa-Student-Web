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
    // Optional visa-type axis. NULL means the entry applies to any visa
    // type for the (nationality, level) pair; "vls_ts" / "vls_t" pin the
    // entry to a specific visa type (the France-Visas portal document
    // list differs slightly between the two).
    visaType: text("visa_type"),
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
    // Unique on the 3-axis natural key. Postgres treats NULLs as distinct,
    // which is the desired behaviour: the NULL-visa-type row coexists with
    // the per-visa-type rows for the same (nationality, level) pair. The
    // matrix is admin-only and writes are extremely low-volume, so the
    // app-layer dedup in routes/matrix.ts is sufficient — concurrent
    // duplicate inserts of the same NULL-visa-type baseline are practically
    // impossible.
    natLevelUq: uniqueIndex("doc_matrix_nat_level_visatype_uq").on(
      t.nationalityCode,
      t.programLevel,
      t.visaType,
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
