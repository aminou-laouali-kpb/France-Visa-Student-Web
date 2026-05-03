import { customFetch } from "@workspace/api-client-react";

export interface Plan {
  tier: "free" | "pro" | "agency";
  name: string;
  priceEur: number;
  priceId: string | null;
  seatLimit: number;
  studentLimit: number;
  aiBudgetUsd: string;
  features: string[];
}
export interface PlansResponse {
  plans: Plan[];
  stripeConfigured: boolean;
}
export interface TenantSettings {
  tenantId: number;
  name: string;
  subdomain: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  emailFromName: string | null;
  emailFromAddress: string | null;
  planTier: string;
  seatLimit: number | null;
  studentLimit: number | null;
  aiMonthlyBudgetUsd: string | null;
  ipAllowlist: string | null;
  twoFactorRequired: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}
export interface BrandingPublic {
  tenantId: number;
  name: string;
  subdomain: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  emailFromName: string | null;
  emailFromAddress: string | null;
}

export const billingApi = {
  plans: () => customFetch<PlansResponse>("/api/billing/plans"),
  checkout: (priceId: string) =>
    customFetch<{ url: string }>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ priceId }),
    }),
  portal: () =>
    customFetch<{ url: string }>("/api/billing/portal", { method: "POST" }),
};

export const tenantApi = {
  settings: () => customFetch<TenantSettings>("/api/tenant/settings"),
  branding: () => customFetch<BrandingPublic | null>("/api/tenant/branding"),
  update: (patch: Partial<TenantSettings>) =>
    customFetch<BrandingPublic>("/api/tenant/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
};

export const twofaApi = {
  status: () =>
    customFetch<{ enabled: boolean; verifiedAt: string | null }>("/api/me/2fa"),
  enroll: () =>
    customFetch<{ secret: string; otpauthUrl: string; qrDataUrl: string }>(
      "/api/me/2fa/enroll",
      { method: "POST" },
    ),
  verify: (code: string) =>
    customFetch<{ enabled: boolean }>("/api/me/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  disable: (code: string) =>
    customFetch<{ enabled: boolean }>("/api/me/2fa", {
      method: "DELETE",
      body: JSON.stringify({ code }),
    }),
};

export const gdprApi = {
  exportZip: async () => {
    const res = await fetch("/api/me/gdpr/export", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  },
  erase: () =>
    customFetch<{ erased: boolean }>("/api/me/gdpr/erase", { method: "POST" }),
};
