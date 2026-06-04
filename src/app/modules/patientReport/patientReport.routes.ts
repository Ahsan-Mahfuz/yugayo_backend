import express from "express";
import { auth } from "../../middleware/auth";
import { PatientReportController } from "./patientReport.controller";

const router = express.Router();

/**
 * GET /api/v1/report/patient/:patientId?days=7|30
 * Clinician downloads a connected patient's digestive health report (PDF).
 */
router.get(
  "/patient/:patientId",
  auth("clinician"),
  PatientReportController.downloadPatientReport,
);

/**
 * GET /api/v1/report/me?days=7|30
 * Patient downloads their own digestive health report (PDF).
 */
router.get("/me", auth("patient"), PatientReportController.downloadMyReport);

export const PatientReportRoutes = router;
