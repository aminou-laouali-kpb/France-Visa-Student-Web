import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { usersTable } from "./users";
import { eefWishesTable } from "./profile";

// ── Projet d'études (one per student) ──────────────────────────────────────
export const projetEtudesTable = pgTable(
  "projet_etudes",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    sections: jsonb("sections"),
    latestScore: jsonb("latest_score"),
    lastCritique: text("last_critique"),
    wordCount: integer("word_count").notNull().default(0),
    lastCritiqueAt: timestamp("last_critique_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqStudent: uniqueIndex("projet_etudes_student_uniq").on(t.studentId),
  }),
);

export const projetEtudesVersionsTable = pgTable(
  "projet_etudes_versions",
  {
    id: serial("id").primaryKey(),
    projetId: integer("projet_id")
      .notNull()
      .references(() => projetEtudesTable.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    sections: jsonb("sections"),
    score: jsonb("score"),
    critique: text("critique"),
    wordCount: integer("word_count").notNull().default(0),
    createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    byProjet: index("projet_versions_projet_idx").on(t.projetId, t.createdAt),
  }),
);

// ── Motivation letters (one per EEF wish) ──────────────────────────────────
export const motivationLettersTable = pgTable(
  "motivation_letters",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    eefWishId: integer("eef_wish_id")
      .notNull()
      .references(() => eefWishesTable.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    latestScore: jsonb("latest_score"),
    lastCritique: text("last_critique"),
    wordCount: integer("word_count").notNull().default(0),
    lastCritiqueAt: timestamp("last_critique_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqWish: uniqueIndex("motivation_letters_wish_uniq").on(t.eefWishId),
    byStudent: index("motivation_letters_student_idx").on(t.studentId),
  }),
);

export const motivationLetterVersionsTable = pgTable(
  "motivation_letter_versions",
  {
    id: serial("id").primaryKey(),
    letterId: integer("letter_id")
      .notNull()
      .references(() => motivationLettersTable.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    score: jsonb("score"),
    critique: text("critique"),
    wordCount: integer("word_count").notNull().default(0),
    createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    byLetter: index("motivation_letter_versions_letter_idx").on(
      t.letterId,
      t.createdAt,
    ),
  }),
);

export const insertProjetEtudesSchema = createInsertSchema(projetEtudesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProjetEtudes = z.infer<typeof insertProjetEtudesSchema>;
export type ProjetEtudes = typeof projetEtudesTable.$inferSelect;
export type ProjetEtudesVersion = typeof projetEtudesVersionsTable.$inferSelect;

export const insertMotivationLetterSchema = createInsertSchema(
  motivationLettersTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMotivationLetter = z.infer<typeof insertMotivationLetterSchema>;
export type MotivationLetter = typeof motivationLettersTable.$inferSelect;
export type MotivationLetterVersion = typeof motivationLetterVersionsTable.$inferSelect;

export interface RubricScore {
  coherence?: number;
  french?: number;
  specificity?: number;
  returnPlan?: number;
  overall?: number;
}
