import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";

// Appointment kinds in the French student-visa pipeline. Beyond the original
// Campus France interview and TLS/VFS biometric drop-off, real-world dossiers
// also track Capago drop-offs (now used for several francophone African
// countries), prefecture appointments for the titre de séjour, and the OFII
// medical visit / VLS-TS validation appointment after arrival in France.
export const appointmentTypeEnum = pgEnum("appointment_type", [
  "campus_france",
  "tls_vfs",
  "capago",
  "prefecture",
  "ofii",
  "biometrics",
  "other",
]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["upcoming", "completed", "cancelled", "missed"]);

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  type: appointmentTypeEnum("type").notNull(),
  title: text("title").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  location: text("location"),
  notes: text("notes"),
  // Provider (e.g. "TLS", "VFS", "Capago"), specific centre/branch (e.g.
  // "Capago Dakar Plateau"), the biometrics fee paid in EUR, and the
  // confirmation / reference number printed on the appointment receipt.
  provider: text("provider"),
  centre: text("centre"),
  feeEur: integer("fee_eur"),
  confirmationNumber: text("confirmation_number"),
  status: appointmentStatusEnum("status").notNull().default("upcoming"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
