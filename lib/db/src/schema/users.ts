import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const roleEnum = pgEnum("role", ["student", "advisor", "reviewer", "admin", "superadmin"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  // Tenant scope. Nullable only during the migration backfill — every new
  // user must be assigned to a tenant.
  tenantId: integer("tenant_id").references(() => tenantsTable.id),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: roleEnum("role").notNull().default("student"),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  // Preferred locale for chat translation: 'fr' (default) for advisors,
  // 'wo' (Wolof), 'ln' (Lingala), 'ar' (Arabic), 'en' (English) for students.
  preferredLanguage: text("preferred_language").notNull().default("fr"),
  isActive: boolean("is_active").notNull().default(true),
  // TOTP 2FA. Required for admin/superadmin (and any tenant with
  // twoFactorRequired). Secret is the base32-encoded shared secret.
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  totpSecret: text("totp_secret"),
  totpVerifiedAt: timestamp("totp_verified_at"),
  // GDPR erasure: account is anonymized in place, audit logs are kept.
  deletedAt: timestamp("deleted_at"),
  // Per-user notification channel matrix. The dispatcher in
  // artifacts/api-server/src/lib/notify.ts fans out a notification to every
  // channel where the corresponding flag is true and the user has the
  // contact info to deliver it (e.g. SMS needs phone). In-app is always
  // on — channels are additive, not exclusive.
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifySms: boolean("notify_sms").notNull().default(false),
  notifyWhatsapp: boolean("notify_whatsapp").notNull().default(false),
  // Optional dedicated WhatsApp number; falls back to `phone` when unset.
  whatsappNumber: text("whatsapp_number"),
  // Per-user secret used to construct an unauthenticated, revocable ICS
  // subscription feed URL (`/api/calendar/feed/:token.ics`). External
  // calendar clients (Google / Outlook) cannot maintain Clerk session
  // cookies, so the token is the bearer of access for read-only feed
  // requests. Rotating the token revokes any existing subscriptions.
  calendarFeedToken: text("calendar_feed_token").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
