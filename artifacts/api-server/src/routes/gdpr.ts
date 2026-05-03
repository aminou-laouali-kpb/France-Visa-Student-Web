import { Router, type IRouter } from "express";
import archiver from "archiver";
import {
  db,
  usersTable,
  studentsTable,
  documentsTable,
  notificationsTable,
  auditLogsTable,
} from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { requireAuth, isAdmin } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function buildExportPayload(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;
  const students = await db
    .select()
    .from(studentsTable)
    .where(or(eq(studentsTable.userId, userId), eq(studentsTable.advisorId, userId), eq(studentsTable.reviewerId, userId)));
  const studentIds = students.map((s) => s.id);
  const documents = studentIds.length
    ? await db
        .select()
        .from(documentsTable)
        .where(or(...studentIds.map((id) => eq(documentsTable.studentId, id))))
    : [];
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId));
  const audits = await db
    .select()
    .from(auditLogsTable)
    .where(eq(auditLogsTable.userId, userId));
  // Strip sensitive fields from the user before export (TOTP secret, etc.).
  const { totpSecret: _ts, ...safeUser } = user;
  return {
    exportedAt: new Date().toISOString(),
    user: safeUser,
    students,
    documents,
    notifications,
    audits,
  };
}

// ─── POST /me/gdpr/export — JSON+ZIP export of all my data ──────────────────
router.post("/me/gdpr/export", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  const payload = await buildExportPayload(user.id);
  if (!payload) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }
  await logAudit({
    userId: user.id,
    action: "gdpr.export",
    entityType: "user",
    entityId: user.id,
  });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="visaflow-export-${user.id}-${Date.now()}.zip"`,
  );
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err: Error) => {
    logger.error({ err }, "gdpr export archive failed");
    try {
      res.status(500).end();
    } catch {
      /* ignore */
    }
  });
  archive.pipe(res);
  archive.append(JSON.stringify(payload, null, 2), { name: "data.json" });
  archive.append(
    [
      "VisaFlow France — Export RGPD",
      `Date: ${payload.exportedAt}`,
      `Utilisateur: ${user.firstName} ${user.lastName} <${user.email}>`,
      "",
      "Le fichier data.json contient l'intégralité de vos données personnelles",
      "stockées dans VisaFlow (profil, dossiers liés, documents, notifications,",
      "logs d'audit). Les fichiers (passeport, lettres) sont référencés par leur",
      "URL d'object storage; demandez à votre conseiller un lien signé pour les",
      "télécharger individuellement.",
      "",
      "Pour exercer votre droit à l'effacement, utilisez l'option \"Supprimer",
      "mon compte\" dans l'écran Confidentialité de votre profil.",
    ].join("\n"),
    { name: "README.txt" },
  );
  await archive.finalize();
});

// ─── POST /me/gdpr/erase — anonymize my account ─────────────────────────────
async function eraseUser(userId: number, actor: number) {
  const stamp = `deleted-${userId}-${Date.now()}`;
  await db
    .update(usersTable)
    .set({
      email: `${stamp}@erased.local`,
      firstName: "Supprimé",
      lastName: "",
      phone: null,
      avatarUrl: null,
      isActive: false,
      totpEnabled: false,
      totpSecret: null,
      deletedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));
  // Anonymize PII on linked student rows owned by this user.
  await db
    .update(studentsTable)
    .set({
      firstName: "Supprimé",
      lastName: "",
      phone: null,
      passportNumber: null,
    })
    .where(eq(studentsTable.userId, userId));
  await logAudit({
    userId: actor,
    action: "gdpr.erase",
    entityType: "user",
    entityId: userId,
  });
}

router.post("/me/gdpr/erase", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  await eraseUser(user.id, user.id);
  res.json({ erased: true });
});

// ─── Staff: erase a target user (e.g. a student account) ────────────────────
router.post("/admin/users/:userId/erase", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  if (!isAdmin(user)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const targetId = Number(req.params.userId);
  if (!Number.isFinite(targetId)) {
    res.status(400).json({ error: "invalid_user_id" });
    return;
  }
  // Tenant scoping: superadmin can erase any account; admin is restricted to
  // their own tenant. Prevents cross-tenant destructive actions.
  const [target] = await db
    .select({ id: usersTable.id, tenantId: usersTable.tenantId })
    .from(usersTable)
    .where(eq(usersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }
  if (user.role !== "superadmin" && target.tenantId !== user.tenantId) {
    res.status(403).json({ error: "cross_tenant_forbidden" });
    return;
  }
  await eraseUser(targetId, user.id);
  res.json({ erased: true });
});

export default router;
