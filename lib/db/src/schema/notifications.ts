import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { studentsTable } from "./students";

export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    studentId: integer("student_id").references(() => studentsTable.id),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull().default("info"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    // Partial unique index — only constrains reminder.* notifications so
    // generic "info" / "comment.*" rows can still repeat. Backs the
    // concurrency-safe dedup in runReminderSweepForStudent.
    reminderDedupUq: uniqueIndex("notifications_reminder_dedup_uq")
      .on(t.userId, t.type)
      .where(sql`type LIKE 'reminder.%'`),
  }),
);

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
