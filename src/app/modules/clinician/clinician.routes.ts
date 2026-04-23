import express from "express";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { ClinicianController } from "./clinician.controller";
import { DietPlanController } from "../dietPlan/dietPlan.controller";
import {
  createDietPlanSchema,
  updateDietPlanSchema,
} from "../dietPlan/dietPlan.validation";

const router = express.Router();

router.use(auth("clinician"));

// ─── My Patients ──────────────────────────────────────────────────────────────

router.get("/patients", ClinicianController.getMyPatients);

// ─── Patient Detail Tabs ──────────────────────────────────────────────────────

router.get(
  "/patients/:patientId/overview",
  ClinicianController.getPatientOverview,
);
router.get(
  "/patients/:patientId/food-logs",
  ClinicianController.getPatientFoodLogs,
);
router.get(
  "/patients/:patientId/symptoms",
  ClinicianController.getPatientSymptoms,
);
router.get(
  "/patients/:patientId/triggers",
  ClinicianController.getPatientTriggers,
);

/**
 * GET /api/v1/clinician/patients/:patientId/trend/weekly
 * Clinician views patient's weekly symptom trend + score chart data
 * Same response shape as GET /symptom-log/trend/weekly (patient's own view)
 */
router.get(
  "/patients/:patientId/trend/weekly",
  ClinicianController.getPatientWeeklyTrend,
);

// ─── Diet Plan ────────────────────────────────────────────────────────────────

router.post(
  "/patients/:patientId/diet-plan",
  validateRequest(createDietPlanSchema),
  DietPlanController.createDietPlan,
);
router.patch(
  "/patients/:patientId/diet-plan",
  validateRequest(updateDietPlanSchema),
  DietPlanController.updateDietPlan,
);
router.get("/patients/:patientId/diet-plan", DietPlanController.getDietPlan);

export const ClinicianRoutes = router;
