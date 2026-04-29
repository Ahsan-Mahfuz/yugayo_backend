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

export const FoodTagsRoutes = router;
