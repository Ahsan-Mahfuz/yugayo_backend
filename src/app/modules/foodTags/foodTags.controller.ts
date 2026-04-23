/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { FoodTagsService } from "./foodTags.service";

/**
 * POST /api/v1/food-tags/generate
 * Collects all usda_ids from patient's food logs (last N days)
 * → calls Python /food/tags → saves + returns trigger analysis
 * Query: days (default 30)
 */
const generateFoodTags = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const days = req.query.days ? Number(req.query.days) : 30;
  const result = await FoodTagsService.generateFoodTags(userId, { days });
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Food trigger analysis generated successfully",
    data: result,
  });
});

/**
 * GET /api/v1/food-tags/my
 * Patient retrieves their latest saved food trigger analysis
 */
const getMyFoodTags = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await FoodTagsService.getMyFoodTags(userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Food trigger analysis retrieved",
    data: result,
  });
});

/**
 * GET /api/v1/clinician/patients/:patientId/food-tags
 * Clinician views a connected patient's food trigger analysis
 */
const getPatientFoodTags = catchAsync(async (req: Request, res: Response) => {
  const result = await FoodTagsService.getPatientFoodTags(req.params.patientId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Patient food trigger analysis retrieved",
    data: result,
  });
});

export const FoodTagsController = {
  generateFoodTags,
  getMyFoodTags,
  getPatientFoodTags,
};
