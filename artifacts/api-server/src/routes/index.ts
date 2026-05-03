import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import referenceRouter from "./reference";
import studentsRouter from "./students";
import documentsRouter from "./documents";
import collabRouter from "./collab";
import adminRouter from "./admin";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(referenceRouter);
router.use(studentsRouter);
router.use(documentsRouter);
router.use(collabRouter);
router.use(adminRouter);
router.use(aiRouter);

export default router;
