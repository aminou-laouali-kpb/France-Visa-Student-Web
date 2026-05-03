import type { RequestHandler } from "express";
import { getTenant } from "../lib/tenant";

const VERIFY_WINDOW_MS = 12 * 60 * 60 * 1000;

const TWOFA_EXEMPT_PATHS = new Set([
  "/me/2fa",
  "/me/2fa/enroll",
  "/me/2fa/verify",
  "/me/2fa/challenge",
]);

/**
 * When the tenant requires 2FA (or the user is admin/superadmin and has
 * enrolled in 2FA), the request must carry a recent TOTP verification.
 * Endpoints to enroll/verify/challenge are exempt so users can satisfy the
 * requirement.
 */
export const enforce2FA: RequestHandler = async (req, res, next) => {
  const user = req.currentUser;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // Allow the 2FA management endpoints themselves to pass through.
  const path = req.path.replace(/\/+$/, "");
  if (TWOFA_EXEMPT_PATHS.has(path)) {
    next();
    return;
  }
  const tenant = await getTenant(user.tenantId);
  const isAdmin = user.role === "admin" || user.role === "superadmin";
  const required = !!tenant?.twoFactorRequired || isAdmin;
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
  const verified = user.totpVerifiedAt ? user.totpVerifiedAt.getTime() : 0;
  if (Date.now() - verified > VERIFY_WINDOW_MS) {
    res.status(403).json({
      error: "twofa_challenge_required",
      message: "Validation 2FA expirée; saisissez un nouveau code.",
    });
    return;
  }
  next();
};
