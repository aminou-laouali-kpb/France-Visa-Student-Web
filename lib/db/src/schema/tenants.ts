import { pgTable, serial, text, numeric, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Used for branded subdomain (e.g. "agency-a.visaflow.fr"). Lowercase
  // alphanumeric+hyphens only; null until configured.
  subdomain: text("subdomain").unique(),
  planTier: text("plan_tier").notNull().default("free"),
  aiMonthlyBudgetUsd: numeric("ai_monthly_budget_usd", { precision: 12, scale: 2 }),
  // Plan-derived limits cached on the tenant for fast access checks.
  seatLimit: integer("seat_limit"),
  studentLimit: integer("student_limit"),
  // White-label branding.
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  emailFromName: text("email_from_name"),
  emailFromAddress: text("email_from_address"),
  // Comma-separated CIDR list (e.g. "203.0.113.0/24,198.51.100.42/32"); null
  // disables IP gating. Enforced for admin/superadmin requests only.
  ipAllowlist: text("ip_allowlist"),
  twoFactorRequired: boolean("two_factor_required").notNull().default(false),
  // Stripe linkage.
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  subscriptionStatus: text("subscription_status"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
