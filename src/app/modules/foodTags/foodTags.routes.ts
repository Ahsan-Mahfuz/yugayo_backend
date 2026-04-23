import express from "express";
import { auth } from "../../middleware/auth";
import { FoodTagsController } from "./foodTags.controller";

const router = express.Router();

/**
 * POST /api/v1/food-tags/generate
 * Patient triggers food tag analysis from their food log history
 * Query: ?days=30  (how many days of logs to include, default 30)
 * 
 * 
 *
 * Flow:
 *  1. Fetch all food logs for user in last N days
 *  2. Extract unique usda_ids (filter out 0s)
 *  3. POST /food/tags to Python AI with usda_ids
 *  4. Upsert result to DB
 *  5. Return saved document
 */
router.post("/generate", auth("patient"), FoodTagsController.generateFoodTags);

/**
 * GET /api/v1/food-tags/my
 * Patient gets their latest saved food trigger analysis
 */
router.get("/my", auth("patient"), FoodTagsController.getMyFoodTags);

export const FoodTagsRoutes = router;
