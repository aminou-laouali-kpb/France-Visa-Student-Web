import { Router, type IRouter } from "express";
import {
  db,
  countriesTable,
  schoolsTable,
  programsTable,
  workflowTemplatesTable,
  workflowStepsTable,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import {
  CreateCountryBody,
  UpdateCountryBody,
  CreateSchoolBody,
  CreateProgramBody,
  CreateWorkflowTemplateBody,
  CreateWorkflowStepBody,
  UpdateWorkflowStepBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// COUNTRIES
router.get("/countries", requireAuth, async (_req, res) => {
  res.json(await db.select().from(countriesTable).orderBy(asc(countriesTable.name)));
});

router.post(
  "/countries",
  requireAuth,
  requireRole("admin", "superadmin"),
  validateBody(CreateCountryBody),
  async (req, res) => {
    const [created] = await db.insert(countriesTable).values(req.body).returning();
    res.status(201).json(created);
  },
);

router.patch(
  "/countries/:countryId",
  requireAuth,
  requireRole("admin", "superadmin"),
  validateBody(UpdateCountryBody),
  async (req, res) => {
    const id = Number(req.params.countryId);
    const [updated] = await db
      .update(countriesTable)
      .set(req.body)
      .where(eq(countriesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Country not found" });
      return;
    }
    res.json(updated);
  },
);

// SCHOOLS
router.get("/schools", requireAuth, async (_req, res) => {
  res.json(await db.select().from(schoolsTable).orderBy(asc(schoolsTable.name)));
});

router.post(
  "/schools",
  requireAuth,
  requireRole("admin", "superadmin", "advisor"),
  validateBody(CreateSchoolBody),
  async (req, res) => {
    const [created] = await db.insert(schoolsTable).values(req.body).returning();
    res.status(201).json(created);
  },
);

router.get("/schools/:schoolId", requireAuth, async (req, res) => {
  const id = Number(req.params.schoolId);
  const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, id));
  if (!school) {
    res.status(404).json({ error: "School not found" });
    return;
  }
  const programs = await db.select().from(programsTable).where(eq(programsTable.schoolId, id));
  res.json({ ...school, programs });
});

router.post(
  "/schools/:schoolId/programs",
  requireAuth,
  requireRole("admin", "superadmin", "advisor"),
  validateBody(CreateProgramBody),
  async (req, res) => {
    const schoolId = Number(req.params.schoolId);
    const [created] = await db
      .insert(programsTable)
      .values({ ...req.body, schoolId })
      .returning();
    res.status(201).json(created);
  },
);

router.get("/programs", requireAuth, async (req, res) => {
  const schoolId = req.query.schoolId ? Number(req.query.schoolId) : undefined;
  const all = await db.select().from(programsTable);
  res.json(schoolId ? all.filter((p) => p.schoolId === schoolId) : all);
});

// WORKFLOWS
router.get("/workflow-templates", requireAuth, async (_req, res) => {
  res.json(await db.select().from(workflowTemplatesTable));
});

router.post(
  "/workflow-templates",
  requireAuth,
  requireRole("admin", "superadmin"),
  validateBody(CreateWorkflowTemplateBody),
  async (req, res) => {
    const [created] = await db.insert(workflowTemplatesTable).values(req.body).returning();
    res.status(201).json(created);
  },
);

router.get(
  "/workflow-templates/:templateId/steps",
  requireAuth,
  async (req, res) => {
    const id = Number(req.params.templateId);
    const steps = await db
      .select()
      .from(workflowStepsTable)
      .where(eq(workflowStepsTable.workflowTemplateId, id))
      .orderBy(asc(workflowStepsTable.order));
    res.json(steps);
  },
);

router.post(
  "/workflow-templates/:templateId/steps",
  requireAuth,
  requireRole("admin", "superadmin"),
  validateBody(CreateWorkflowStepBody),
  async (req, res) => {
    const templateId = Number(req.params.templateId);
    const [created] = await db
      .insert(workflowStepsTable)
      .values({ ...req.body, workflowTemplateId: templateId })
      .returning();
    res.status(201).json(created);
  },
);

router.patch(
  "/workflow-steps/:stepId",
  requireAuth,
  requireRole("admin", "superadmin"),
  validateBody(UpdateWorkflowStepBody),
  async (req, res) => {
    const id = Number(req.params.stepId);
    const [updated] = await db
      .update(workflowStepsTable)
      .set(req.body)
      .where(eq(workflowStepsTable.id, id))
      .returning();
    res.json(updated);
  },
);

export default router;
