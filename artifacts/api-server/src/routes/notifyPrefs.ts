import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/me/notification-prefs", requireAuth, async (req, res) => {
  const u = req.currentUser!;
  res.json({
    notifyEmail: u.notifyEmail,
    notifySms: u.notifySms,
    notifyWhatsapp: u.notifyWhatsapp,
    phone: u.phone,
    whatsappNumber: u.whatsappNumber,
    preferredLanguage: u.preferredLanguage,
  });
});

const patchSchema = z.object({
  notifyEmail: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
  phone: z.string().nullable().optional(),
  whatsappNumber: z.string().nullable().optional(),
  preferredLanguage: z.enum(["fr", "en", "ar", "pt", "wo", "ln"]).optional(),
});

router.patch("/me/notification-prefs", requireAuth, async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.message });
    return;
  }
  const u = req.currentUser!;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updates[k] = v;
  }
  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, u.id))
    .returning();
  res.json({
    notifyEmail: updated!.notifyEmail,
    notifySms: updated!.notifySms,
    notifyWhatsapp: updated!.notifyWhatsapp,
    phone: updated!.phone,
    whatsappNumber: updated!.whatsappNumber,
    preferredLanguage: updated!.preferredLanguage,
  });
});

export default router;
