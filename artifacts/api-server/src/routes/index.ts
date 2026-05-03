import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import referenceRouter from "./reference";
import studentsRouter from "./students";
import documentsRouter from "./documents";
import collabRouter from "./collab";
import adminRouter from "./admin";
import aiRouter from "./ai";
import profileRouter from "./profile";
import financeRouter from "./finance";
import matrixRouter from "./matrix";
import projetRouter from "./projet";
import postArrivalRouter from "./postArrival";
import copilotRouter from "./copilot";
import interviewRouter from "./interview";
import twofaRouter from "./twofa";
import brandingRouter from "./branding";
import billingRouter from "./billing";
import gdprRouter from "./gdpr";
import { requireAuth } from "../middlewares/auth";
import { requireAdminIp } from "../middlewares/ipAllowlist";
import { enforce2FA } from "../middlewares/twoFactor";

const router: IRouter = Router();

// Enforce per-tenant admin IP allowlist + 2FA policy on every admin-prefixed
// route (audit logs, user management, branding, billing). Mounted before the
// individual routers so they inherit the guards without re-declaring them.
router.use("/admin", requireAuth, requireAdminIp, enforce2FA);
router.use("/tenant/settings", requireAuth, requireAdminIp, enforce2FA);

router.use(healthRouter);
router.use(usersRouter);
router.use(referenceRouter);
router.use(studentsRouter);
router.use(documentsRouter);
router.use(collabRouter);
router.use(adminRouter);
router.use(aiRouter);
router.use(profileRouter);
router.use(financeRouter);
router.use(matrixRouter);
router.use(projetRouter);
router.use(postArrivalRouter);
router.use(copilotRouter);
router.use(interviewRouter);
router.use(twofaRouter);
router.use(brandingRouter);
router.use(billingRouter);
router.use(gdprRouter);

export default router;
