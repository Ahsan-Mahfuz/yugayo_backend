import express from "express";
import { auth } from "../../middleware/auth";
import { ScoreController } from "./score.controller";

const router = express.Router();

// ─── Patient routes ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/score/me
 * Patient retrieves their own gut health score for the home screen card.
 */
router.get("/me", auth("patient"), ScoreController.getMyScore);

// ─── Admin routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/score/admin/all
 * Query params: page, limit, grade, minScore, maxScore
 */
router.get("/admin/all", auth("admin"), ScoreController.getAllScores);

/**
 * GET /api/v1/score/admin/user/:userId
 */
router.get(
  "/admin/user/:userId",
  auth("admin"),
  ScoreController.getScoreByUserId,
);

router.get(
  "/patients",
  auth("clinician", "admin"),
  ScoreController.getPatients,
);

router.get(
  "/:id/details",
  auth("clinician", "admin"),
  ScoreController.getPatientDetailsController,
);

export const ScoreRoutes = router;
