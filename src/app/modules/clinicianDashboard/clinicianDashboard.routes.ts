import express from "express";
import { auth } from "../../middleware/auth";
import { DietPlanController } from "../dietPlan/dietPlan.controller";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createDietPlanSchema,
  updateDietPlanSchema,
} from "../dietPlan/dietPlan.validation";
import { ClinicianDashboardController } from "./clinicianDashboard.controller";

const router = express.Router();

// All routes require clinician auth
router.use(auth("clinician"));

// ─── Dashboard Home ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/clinician/dashboard/summary
 * Returns: totalPatients, activeToday, severeSymptomsCount, atRiskCount
 */
router.get(
  "/dashboard/summary",
  ClinicianDashboardController.getDashboardSummary,
);

/**
 * GET /api/v1/clinician/dashboard/alerts
 * Recent severe symptom logs from connected patients
 * Query: page, limit
 */
router.get("/dashboard/alerts", ClinicianDashboardController.getRecentAlerts);

/**
 * GET /api/v1/clinician/dashboard/activity
 * Merged food + symptom recent activity from connected patients
 * Query: page, limit
 */
router.get(
  "/dashboard/activity",
  ClinicianDashboardController.getRecentActivity,
);

/**
 * GET /api/v1/clinician/dashboard/at-risk
 * Patients with gut health score < 40
 */
router.get(
  "/dashboard/at-risk",
  ClinicianDashboardController.getAtRiskPatients,
);

// ─── My Patients ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/clinician/patients
 * All connected patients with enriched score and status.
 *
 * Query params:
 *   page    number   (default 1)
 *   limit   number   (default 20)
 *   search  string   filter by name or email
 *   status  string   "Stable" | "At Risk" | "Flare-up"
 *                    Stable   = score 65–100
 *                    At Risk  = score 40–64
 *                    Flare-up = score < 40
 */
router.get("/patients", ClinicianDashboardController.getMyPatients);

// ─── Patient Detail Tabs ──────────────────────────────────────────────────────

/**
 * GET /api/v1/clinician/patients/:patientId/overview
 * Full patient profile, gut score, recent activity, diet plan status
 */
router.get(
  "/patients/:patientId/overview",
  ClinicianDashboardController.getPatientOverview,
);

/**
 * GET /api/v1/clinician/patients/:patientId/food-logs
 * Query: date (YYYY-MM-DD), mealType, page, limit
 */
router.get(
  "/patients/:patientId/food-logs",
  ClinicianDashboardController.getPatientFoodLogs,
);

/**
 * GET /api/v1/clinician/patients/:patientId/symptoms
 * Query: date (YYYY-MM-DD), page, limit
 */
router.get(
  "/patients/:patientId/symptoms",
  ClinicianDashboardController.getPatientSymptoms,
);

/**
 * GET /api/v1/clinician/patients/:patientId/triggers
 * Query: days (default 30)
 */
router.get(
  "/patients/:patientId/triggers",
  ClinicianDashboardController.getPatientTriggers,
);

/**
 * GET /api/v1/clinician/patients/:patientId/trend/weekly
 * Weekly symptom trend + score chart data
 */
router.get(
  "/patients/:patientId/trend/weekly",
  ClinicianDashboardController.getPatientWeeklyTrend,
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

export const ClinicianDashboardRoutes = router;
