import express from "express";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { symptomLogSchema } from "./symptomLog.validation";
import { SymptomLogController } from "./symptomLog.controller";

const router = express.Router();

router.use(auth("patient"));

/**
 * GET /api/v1/symptom-log/trend/weekly
 * ⚠️ Must be defined BEFORE /:id to avoid conflict
 */
router.get("/trend/weekly", SymptomLogController.getWeeklyTrend);

/**
 * GET /api/v1/symptom-log/:id
 * Get a single symptom log entry by ID
 */
router.get("/:id", SymptomLogController.getSymptomLogById);

/**
 * POST /api/v1/symptom-log
 */
router.post(
  "/",
  validateRequest(symptomLogSchema),
  SymptomLogController.logSymptoms,
);

/**
 * GET /api/v1/symptom-log?date=YYYY-MM-DD&page=1&limit=20
 */
router.get("/", SymptomLogController.getMySymptomLogs);

export const SymptomLogRoutes = router;
