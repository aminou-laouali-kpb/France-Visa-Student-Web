import type { RequestHandler } from "express";
import { getTenant } from "../lib/tenant";

// Endpoints required to bootstrap the app and self-serve 2FA enrollment.
// `/users/me` and `/tenant/branding` are needed by the frontend on every
// page load; `/me/2fa/*` are needed for the user to satisfy the policy.
const TWOFA_EXEMPT_PATHS = new Set([
  "/users/me",
  "/tenant/branding",
  "/me/2fa",
  "/me/2fa/enroll",
  "/me/2fa/verify",
  "/me/2fa/challenge",
]);

/**
 * Tenant policy: when `twoFactorRequired` is on (or the user is an admin in
 * a tenant that has enabled it), the user must have TOTP enabled before
 * accessing any privileged endpoint. We deliberately do NOT add a "fresh
 * challenge" window — Clerk handles login, and a per-call challenge has
 * no UI today; enforcing it would lock admins out of routine API calls.
 * The tenant gets the same protection by simply requiring TOTP enrolment
 * for admins.
 */
export const enforce2FA: RequestHandler = async (req, res, next) => {
  const user = req.currentUser;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const path = req.path.replace(/\/+$/, "");
  if (TWOFA_EXEMPT_PATHS.has(path)) {
    next();
    return;
  }
  const tenant = await getTenant(user.tenantId);
  const isAdmin = user.role === "admin" || user.role === "superadmin";
  // 2FA policy:
  //   - Admins/superadmins must always have TOTP enabled. They wield
  //     tenant-wide power, so a hard requirement is non-negotiable
  //     regardless of per-tenant config.
  //   - Other roles must have TOTP enabled when their tenant has
  //     `twoFactorRequired` on (e.g. enterprise/regulated tenants).
  const required = isAdmin || !!tenant?.twoFactorRequired;
  if (!required) {
    next();
    return;
  }
  if (!user.totpEnabled) {
    res.status(403).json({
      error: "twofa_required",
      message: "Activez l'authentification à deux facteurs pour continuer.",
    });
    return;
  }
  next();
};
