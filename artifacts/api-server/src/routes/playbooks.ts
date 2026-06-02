import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { db, playbooksTable, playbookStepsTable, PLAYBOOK_PHASES } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { requireAuth, isAdmin } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { getPlaybooksAdminCatalog, type PlaybookAdmin } from "../lib/playbooks";

const router: IRouter = Router();

const PlaybookStepInput = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  sortOrder: z.number().int().nonnegative().optional(),
  checklist: z.array(z.string()).optional().default([]),
});

const CreatePlaybookBody = z.object({
  slug: z.string().min(1).max(64),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  phase: z.enum(PLAYBOOK_PHASES),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().nonnegative().optional().default(0),
  steps: z.array(PlaybookStepInput).optional().default([]),
});

const UpdatePlaybookBody = z.object({
  slug: z.string().min(1).max(64).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  phase: z.enum(PLAYBOOK_PHASES).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  steps: z.array(PlaybookStepInput).optional(),
});

async function playbookWithSteps(id: number): Promise<PlaybookAdmin | null> {
  const [playbook] = await db.select().from(playbooksTable).where(eq(playbooksTable.id, id));
  if (!playbook) return null;
  const steps = await db
    .select()
    .from(playbookStepsTable)
    .where(eq(playbookStepsTable.playbookId, id))
    .orderBy(asc(playbookStepsTable.sortOrder), asc(playbookStepsTable.id));
  return {
    id: playbook.id,
    slug: playbook.slug,
    title: playbook.title,
    description: playbook.description,
    phase: playbook.phase as PlaybookAdmin["phase"],
    isActive: playbook.isActive,
    sortOrder: playbook.sortOrder,
    steps: steps.map((s) => ({
      id: s.id,
      title: s.title,
      body: s.body,
      sortOrder: s.sortOrder,
      checklist: s.checklist ?? [],
    })),
  };
}

router.get("/playbooks", requireAuth, async (req, res) => {
  if (!isAdmin(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(await getPlaybooksAdminCatalog());
});

router.post("/playbooks", requireAuth, async (req, res) => {
  if (!isAdmin(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const parsed = CreatePlaybookBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const body = parsed.data;
  const [created] = await db
    .insert(playbooksTable)
    .values({
      slug: body.slug,
      title: body.title,
      description: body.description ?? null,
      phase: body.phase,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
    })
    .returning();
  if (body.steps.length > 0) {
    await db.insert(playbookStepsTable).values(
      body.steps.map((s, idx) => ({
        playbookId: created.id,
        title: s.title,
        body: s.body,
        sortOrder: s.sortOrder ?? idx + 1,
        checklist: s.checklist ?? [],
      })),
    );
  }
  await logAudit({
    userId: req.currentUser!.id,
    action: "playbook.create",
    entityType: "playbook",
    entityId: created.id,
    details: JSON.stringify({ slug: created.slug }),
  });
  res.status(201).json(await playbookWithSteps(created.id));
});

router.patch(
  "/playbooks/:playbookId",
  requireAuth,
  validateBody(UpdatePlaybookBody),
  async (req, res) => {
    if (!isAdmin(req.currentUser!)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const id = Number(req.params.playbookId);
    const parsed = UpdatePlaybookBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
    const body = parsed.data;
    const [existing] = await db.select().from(playbooksTable).where(eq(playbooksTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Playbook not found" });
      return;
    }
    const patch: Partial<typeof playbooksTable.$inferInsert> = { updatedAt: new Date() };
    if (body.slug !== undefined) patch.slug = body.slug;
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    if (body.phase !== undefined) patch.phase = body.phase;
    if (body.isActive !== undefined) patch.isActive = body.isActive;
    if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;
    await db.update(playbooksTable).set(patch).where(eq(playbooksTable.id, id));
    if (body.steps !== undefined) {
      await db.delete(playbookStepsTable).where(eq(playbookStepsTable.playbookId, id));
      if (body.steps.length > 0) {
        await db.insert(playbookStepsTable).values(
          body.steps.map((s, idx) => ({
            playbookId: id,
            title: s.title,
            body: s.body,
            sortOrder: s.sortOrder ?? idx + 1,
            checklist: s.checklist ?? [],
          })),
        );
      }
    }
    await logAudit({
      userId: req.currentUser!.id,
      action: "playbook.update",
      entityType: "playbook",
      entityId: id,
      details: JSON.stringify({ slug: body.slug ?? existing.slug }),
    });
    res.json(await playbookWithSteps(id));
  },
);

router.delete("/playbooks/:playbookId", requireAuth, async (req, res) => {
  if (!isAdmin(req.currentUser!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = Number(req.params.playbookId);
  const [existing] = await db.select().from(playbooksTable).where(eq(playbooksTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Playbook not found" });
    return;
  }
  await db.delete(playbooksTable).where(eq(playbooksTable.id, id));
  await logAudit({
    userId: req.currentUser!.id,
    action: "playbook.delete",
    entityType: "playbook",
    entityId: id,
    details: JSON.stringify({ slug: existing.slug }),
  });
  res.status(204).send();
});

export default router;
