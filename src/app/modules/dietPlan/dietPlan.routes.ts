import express from "express";
import { auth } from "../../middleware/auth";
import { DietPlanController } from "../dietPlan/dietPlan.controller";

const router = express.Router();

/**
 * GET /api/v1/diet-plan/my
 * Patient views their own active diet plan (created by their clinician)
 */
router.get("/my", auth("patient"), DietPlanController.getMyDietPlan);

export const DietPlanRoutes = router;