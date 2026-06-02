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
import calendarRouter from "./calendar";
import dossierPdfRouter from "./dossierPdf";
import bulkImportRouter from "./bulkImport";
import notifyPrefsRouter from "./notifyPrefs";
import playbooksRouter from "./playbooks";

const router: IRouter = Router();

// Note: per-tenant admin IP allowlist + tenant 2FA enforcement are applied
// globally inside `requireAuth` (artifacts/api-server/src/middlewares/auth.ts),
// so they cover every privileged route regardless of URL prefix.

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
router.use(calendarRouter);
router.use(dossierPdfRouter);
router.use(bulkImportRouter);
router.use(notifyPrefsRouter);
router.use(playbooksRouter);

export default router;
