import express from "express";
import { auth } from "../../middleware/auth";
import { SymptomFoodReportController } from "./foodSymptomInsight.controller";

const router = express.Router();

router.get("/", auth("patient"), SymptomFoodReportController.getMyReport);

router.get(
  "/patient/:patientId",
  auth("clinician"),
  SymptomFoodReportController.getPatientReport,
);

export const SymptomFoodReportRoutes = router;
