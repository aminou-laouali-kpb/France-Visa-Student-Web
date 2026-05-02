import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { studentsTable } from "./students";

export const appointmentTypeEnum = pgEnum("appointment_type", ["campus_france", "tls_vfs", "other"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["upcoming", "completed", "cancelled", "missed"]);

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  type: appointmentTypeEnum("type").notNull(),
  title: text("title").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  location: text("location"),
  notes: text("notes"),
  status: appointmentStatusEnum("status").notNull().default("upcoming"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
