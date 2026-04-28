import express from "express";
import { auth } from "../../middleware/auth";
import { SafeFoodController } from "./safeFood.controller";

const router = express.Router();

router.use(auth("patient"));

/**
 * GET /api/v1/safe-food
 * Returns the last saved safe food recommendations from DB
 */
router.get("/", SafeFoodController.getSafeFoods);

/**
 * POST /api/v1/safe-food/generate
 * Generates fresh recommendations using last 3 months of history
 */
router.post("/generate", SafeFoodController.generateSafeFoods);

export const SafeFoodRoutes = router;
