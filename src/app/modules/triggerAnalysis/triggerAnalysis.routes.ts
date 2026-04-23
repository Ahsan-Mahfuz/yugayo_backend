import express from "express";
import { auth } from "../../middleware/auth";
import { TriggerAnalysisController } from "./triggerAnalysis.controller";

const router = express.Router();

/**
 * POST /api/v1/triggers/generate
 * Patient generates their trigger analysis from last 3 months of logs
 * Query: ?days=90
 *
 * ⚠️  This is a HEAVY call — takes 10-30s
 *     It calls /recommend/risky_food (analyzes 90 days of food+symptom history)
 *     then calls /recommend/triggers_food for EACH detected symptom
 */
router.post(
  "/generate",
  auth("patient"),
  TriggerAnalysisController.generateTriggerAnalysis,
);

/**
 * GET /api/v1/triggers/my
 * Patient retrieves their latest saved trigger analysis instantly from DB
 */
router.get(
  "/my",
  auth("patient"),
  TriggerAnalysisController.getMyTriggerAnalysis,
);


export const TriggerAnalysisRoutes = router;
