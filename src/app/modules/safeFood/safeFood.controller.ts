/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { SafeFoodService } from "./safeFood.service";

/**
 * GET /api/v1/safe-food
 * Returns cached safe food recommendations from DB
 */
const getSafeFoods = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await SafeFoodService.getSafeFoods(userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Safe food recommendations retrieved successfully",
    data: result,
  });
});

/**
 * POST /api/v1/safe-food/generate
 * Calls AI with last 3 months of history, saves and returns result
 */
const generateSafeFoods = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await SafeFoodService.generateSafeFoods(userId);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Safe food recommendations generated successfully",
    data: result,
  });
});

export const SafeFoodController = {
  getSafeFoods,
  generateSafeFoods,
};
