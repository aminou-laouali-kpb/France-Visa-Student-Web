import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, isAdmin } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { validateBody } from "../middlewares/validate";
import { UpdateMeBody, UpdateUserBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req, res) => {
  res.json(req.currentUser);
});

router.patch("/users/me", requireAuth, validateBody(UpdateMeBody), async (req, res) => {
  const { firstName, lastName, phone, avatarUrl, preferredLanguage } = req.body ?? {};
  const allowedLangs = ["fr", "en", "wo", "ln", "ar"];
  const [updated] = await db
    .update(usersTable)
    .set({
      firstName: firstName ?? req.currentUser!.firstName,
      lastName: lastName ?? req.currentUser!.lastName,
      phone: phone ?? req.currentUser!.phone,
      avatarUrl: avatarUrl ?? req.currentUser!.avatarUrl,
      preferredLanguage:
        typeof preferredLanguage === "string" && allowedLangs.includes(preferredLanguage)
          ? preferredLanguage
          : req.currentUser!.preferredLanguage,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, req.currentUser!.id))
    .returning();
  res.json(updated);
});

router.get("/users", requireAuth, async (req, res) => {
  const me = req.currentUser!;
  // Admins/superadmins see the full directory. Advisors and reviewers may
  // need to look up colleagues (e.g. when reassigning a task) but should
  // not get sensitive user fields — return a limited public projection.
  // Students cannot list users at all.
  if (!isAdmin(me) && me.role !== "advisor" && me.role !== "reviewer") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const role = req.query.role as string | undefined;
  // Tenant scoping (fail-closed): superadmin sees the global directory,
  // every other role is restricted to their own tenant. Callers with no
  // tenantId resolve to the default tenant (id=1) rather than "all".
  const all =
    me.role === "superadmin"
      ? await db.select().from(usersTable)
      : await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.tenantId, me.tenantId ?? 1));
  const filtered = role ? all.filter((u) => u.role === role) : all;
  if (isAdmin(me)) {
    res.json(filtered);
    return;
  }
  res.json(
    filtered.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      avatarUrl: u.avatarUrl,
      role: u.role,
    })),
  );
});

router.get("/users/:userId", requireAuth, async (req, res) => {
  const id = Number(req.params.userId);
  if (
    id !== req.currentUser!.id &&
    !isAdmin(req.currentUser!) &&
    req.currentUser!.role !== "advisor" &&
    req.currentUser!.role !== "reviewer"
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!u) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // Cross-tenant lookups are blocked unless the caller is the user
  // themselves or a superadmin. Fail-closed for null tenantIds.
  if (u.id !== req.currentUser!.id && req.currentUser!.role !== "superadmin") {
    const callerTenant = req.currentUser!.tenantId ?? 1;
    const targetTenant = u.tenantId ?? 1;
    if (callerTenant !== targetTenant) {
      res.status(404).json({ error: "User not found" });
      return;
    }
  }
  // Non-admins get a limited public projection
  if (!isAdmin(req.currentUser!) && id !== req.currentUser!.id) {
    res.json({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      avatarUrl: u.avatarUrl,
      role: u.role,
    });
    return;
  }
  res.json(u);
});

router.patch(
  "/users/:userId",
  requireAuth,
  requireRole("admin", "superadmin"),
  validateBody(UpdateUserBody),
  async (req, res) => {
    const id = Number(req.params.userId);
    const { role, isActive, firstName, lastName, phone } = req.body ?? {};
    // Tenant scoping: admin can only mutate users in their own tenant.
    const [target] = await db
      .select({ id: usersTable.id, tenantId: usersTable.tenantId })
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (req.currentUser!.role !== "superadmin") {
      const callerTenant = req.currentUser!.tenantId ?? 1;
      const targetTenant = target.tenantId ?? 1;
      if (callerTenant !== targetTenant) {
        res.status(403).json({ error: "cross_tenant_forbidden" });
        return;
      }
    }
    const [updated] = await db
      .update(usersTable)
      .set({
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    await logAudit({
      userId: req.currentUser!.id,
      action: "user.update",
      entityType: "user",
      entityId: id,
      details: JSON.stringify({ role, isActive }),
    });
    res.json(updated);
  },
);

export default router;
