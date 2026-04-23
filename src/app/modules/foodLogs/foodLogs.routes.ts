import express from "express";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import {
  manualFoodLogSchema,
  voiceFoodLogSchema,
  barcodeFoodLogSchema,
} from "./foodLogs.validation";
import { FoodLogController } from "./foodLogs.controller";

const router = express.Router();

router.use(auth("patient"));

/**
 * POST /api/v1/food-log/manual
 * Flow: food names → /food/parse (usda_id) → /log/food → save to DB
 */
router.post(
  "/manual",
  validateRequest(manualFoodLogSchema),
  FoodLogController.manualLog,
);

/**
 * POST /api/v1/food-log/voice
 * Flow: voice text → /food/text-to-id → /log/food → save to DB
 */
router.post(
  "/voice",
  validateRequest(voiceFoodLogSchema),
  FoodLogController.voiceLog,
);

/**
 * POST /api/v1/food-log/barcode
 * Flow: barcode → /scan/barcode (product name) → /food/parse (usda_id) → /log/food → save to DB
 */
router.post(
  "/barcode",
  validateRequest(barcodeFoodLogSchema),
  FoodLogController.barcodeLog,
);

/**
 * GET /api/v1/food-log
 * Query: date, mealType, page, limit
 */
router.get("/", FoodLogController.getMyLogs);

export const FoodLogRoutes = router;
