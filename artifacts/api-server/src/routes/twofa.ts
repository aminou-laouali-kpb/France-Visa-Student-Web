import { Router, type IRouter } from "express";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

const ISSUER = "VisaFlow France";

function checkCode(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  try {
    const r = verifySync({ secret, token });
    return r.valid;
  } catch {
    return false;
  }
}

// ─── POST /me/2fa/enroll ────────────────────────────────────────────────────
router.post("/me/2fa/enroll", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  const secret = generateSecret();
  const otpauth = generateURI({ issuer: ISSUER, label: user.email, secret });
  await db.update(usersTable).set({ totpSecret: secret }).where(eq(usersTable.id, user.id));
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(otpauth);
  } catch {
    /* leave empty */
  }
  res.json({ secret, otpauthUrl: otpauth, qrDataUrl });
});

// ─── POST /me/2fa/verify ────────────────────────────────────────────────────
router.post("/me/2fa/verify", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  const code = String((req.body as { code?: unknown })?.code ?? "").trim();
  if (!user.totpSecret) {
    res.status(400).json({ error: "no_pending_enrollment" });
    return;
  }
  if (!checkCode(user.totpSecret, code)) {
    res.status(400).json({ error: "invalid_code" });
    return;
  }
  await db
    .update(usersTable)
    .set({ totpEnabled: true, totpVerifiedAt: new Date() })
    .where(eq(usersTable.id, user.id));
  await logAudit({
    userId: user.id,
    action: "twofa.enabled",
    entityType: "user",
    entityId: user.id,
  });
  res.json({ enabled: true });
});

// ─── POST /me/2fa/challenge ─────────────────────────────────────────────────
router.post("/me/2fa/challenge", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  const code = String((req.body as { code?: unknown })?.code ?? "").trim();
  if (!user.totpEnabled || !user.totpSecret) {
    res.status(400).json({ error: "twofa_not_enabled" });
    return;
  }
  if (!checkCode(user.totpSecret, code)) {
    res.status(400).json({ error: "invalid_code" });
    return;
  }
  await db
    .update(usersTable)
    .set({ totpVerifiedAt: new Date() })
    .where(eq(usersTable.id, user.id));
  res.json({ verified: true });
});

// ─── DELETE /me/2fa ─────────────────────────────────────────────────────────
router.delete("/me/2fa", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  const code = String((req.body as { code?: unknown })?.code ?? "").trim();
  if (user.totpEnabled && user.totpSecret) {
    if (!checkCode(user.totpSecret, code)) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }
  }
  await db
    .update(usersTable)
    .set({ totpEnabled: false, totpSecret: null, totpVerifiedAt: null })
    .where(eq(usersTable.id, user.id));
  await logAudit({
    userId: user.id,
    action: "twofa.disabled",
    entityType: "user",
    entityId: user.id,
  });
  res.json({ enabled: false });
});

// ─── GET /me/2fa ────────────────────────────────────────────────────────────
router.get("/me/2fa", requireAuth, (req, res) => {
  const user = req.currentUser!;
  res.json({
    enabled: user.totpEnabled,
    verifiedAt: user.totpVerifiedAt ? user.totpVerifiedAt.toISOString() : null,
  });
});

export default router;
