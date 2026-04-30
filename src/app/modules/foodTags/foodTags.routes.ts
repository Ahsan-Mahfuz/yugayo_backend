import express from "express";
import { auth } from "../../middleware/auth";
import { FoodTagsController } from "./foodTags.controller";

const router = express.Router();

/**
 * GET /api/v1/food-tags/my
 * Patient gets food culprit risk analysis computed from logs
 * Query: ?days=30&symptom=Bloating
 */
router.get("/my", auth("patient"), FoodTagsController.getMyFoodTags);

/**
 * GET /api/v1/food-tags/clinician/patients/:patientId
 * Clinician gets same trigger data as patient /food-tags/my
 * Query: ?days=30&symptom=Bloating
 */
router.get(
  "/patients/:patientId",
  auth("clinician"),
  FoodTagsController.getClinicianPatientFoodTags,
);

export const FoodTagsRoutes = router;
