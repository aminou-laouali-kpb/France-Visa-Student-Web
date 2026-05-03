import { Router, type IRouter } from "express";
import { checkAiHealth } from "@workspace/ai";
import { GetAiHealthResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/ai/health", requireAuth, async (req, res) => {
  const u = req.currentUser!;
  if (!["admin", "superadmin"].includes(u.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const report = await checkAiHealth(null);
  const data = GetAiHealthResponse.parse({
    configured: report.configured,
    reachable: report.reachable,
    model: report.model,
    monthlyBudgetUsd: report.monthlyBudgetUsd,
    monthSpentUsd: Number(report.monthSpentUsd.toFixed(6)),
    error: report.error,
  });
  res.json(data);
});

export default router;
