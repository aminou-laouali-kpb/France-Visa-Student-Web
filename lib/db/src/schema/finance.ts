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
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { documentsTable } from "./documents";

// ── Reference: scholarships ─────────────────────────────────────────────────
export const scholarshipsTable = pgTable(
  "scholarships",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    provider: text("provider"),
    description: text("description"),
    coversTuition: boolean("covers_tuition").notNull().default(false),
    coversLiving: boolean("covers_living").notNull().default(false),
    monthlyAmountEur: integer("monthly_amount_eur"),
    countryCode: text("country_code"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("scholarships_code_uniq").on(t.code),
  }),
);

// ── Financial proofs ────────────────────────────────────────────────────────
export const financialProofTypeEnum = pgEnum("financial_proof_type", [
  "bank_attestation",
  "scholarship_letter",
  "guarantor_declaration",
  "avi_certificate",
  "other",
]);

export const financialProofStatusEnum = pgEnum("financial_proof_status", [
  "pending",
  "valid",
  "expired",
  "rejected",
]);

export const financialProofsTable = pgTable(
  "financial_proofs",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    proofType: financialProofTypeEnum("proof_type").notNull(),
    scholarshipId: integer("scholarship_id").references(() => scholarshipsTable.id),
    providerName: text("provider_name"),
    guarantorName: text("guarantor_name"),
    guarantorRelation: text("guarantor_relation"),
    amountEur: numeric("amount_eur", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("EUR"),
    issueDate: text("issue_date"),
    expiryDate: text("expiry_date"),
    documentId: integer("document_id").references(() => documentsTable.id),
    status: financialProofStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    byStudent: index("financial_proofs_student_idx").on(t.studentId),
  }),
);

// ── Accommodation records ───────────────────────────────────────────────────
export const accommodationTypeEnum = pgEnum("accommodation_type", [
  "crous",
  "private_lease",
  "host_attestation",
  "student_residence",
  "hotel_temporary",
  "other",
]);

export const accommodationStatusEnum = pgEnum("accommodation_status", [
  "pending",
  "valid",
  "expired",
  "rejected",
]);

export const accommodationRecordsTable = pgTable(
  "accommodation_records",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    accommodationType: accommodationTypeEnum("accommodation_type").notNull(),
    addressLine: text("address_line"),
    postalCode: text("postal_code"),
    city: text("city"),
    countryCode: text("country_code").notNull().default("FR"),
    providerName: text("provider_name"),
    hostFirstName: text("host_first_name"),
    hostLastName: text("host_last_name"),
    hostRelation: text("host_relation"),
    monthlyCostEur: numeric("monthly_cost_eur", { precision: 10, scale: 2 }),
    startDate: text("start_date"),
    endDate: text("end_date"),
    documentId: integer("document_id").references(() => documentsTable.id),
    status: accommodationStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    byStudent: index("accommodation_student_idx").on(t.studentId),
  }),
);

// ── CVEC payments ───────────────────────────────────────────────────────────
export const cvecStatusEnum = pgEnum("cvec_status", [
  "pending",
  "paid",
  "exempted",
  "rejected",
]);

export const cvecPaymentsTable = pgTable(
  "cvec_payments",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    academicYear: text("academic_year").notNull(),
    amountEur: numeric("amount_eur", { precision: 8, scale: 2 }).notNull().default("103.00"),
    paidAt: text("paid_at"),
    receiptNumber: text("receipt_number"),
    attestationDocumentId: integer("attestation_document_id").references(
      () => documentsTable.id,
    ),
    status: cvecStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    byStudent: index("cvec_payments_student_idx").on(t.studentId),
    uniqStudentYear: uniqueIndex("cvec_payments_student_year_uniq").on(
      t.studentId,
      t.academicYear,
    ),
  }),
);

// ── Inferred types ──────────────────────────────────────────────────────────
export const insertScholarshipSchema = createInsertSchema(scholarshipsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertScholarship = z.infer<typeof insertScholarshipSchema>;
export type Scholarship = typeof scholarshipsTable.$inferSelect;

export const insertFinancialProofSchema = createInsertSchema(financialProofsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFinancialProof = z.infer<typeof insertFinancialProofSchema>;
export type FinancialProof = typeof financialProofsTable.$inferSelect;

export const insertAccommodationRecordSchema = createInsertSchema(
  accommodationRecordsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAccommodationRecord = z.infer<typeof insertAccommodationRecordSchema>;
export type AccommodationRecord = typeof accommodationRecordsTable.$inferSelect;

export const insertCvecPaymentSchema = createInsertSchema(cvecPaymentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCvecPayment = z.infer<typeof insertCvecPaymentSchema>;
export type CvecPayment = typeof cvecPaymentsTable.$inferSelect;
