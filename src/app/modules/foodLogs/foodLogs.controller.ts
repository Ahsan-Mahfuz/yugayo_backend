/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { FoodLogService } from "./foodLogs.service";

const extractClientMeta = (req: Request) => ({
  timezone: (req.headers["x-timezone"] as string) || undefined,
  utcOffsetMinutes: req.headers["x-utc-offset-minutes"]
    ? Number(req.headers["x-utc-offset-minutes"])
    : undefined,
  country: (req.headers["x-country-code"] as string) || undefined,
});

/**
 * POST /api/v1/food-log/manual
 * Body: { foods: [{ foodName, quantity, unit }], mealType }
 */
const manualLog = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await FoodLogService.manualLog(
    userId,
    req.body,
    extractClientMeta(req),
  );
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Meal logged successfully",
    data: result,
  });
});

/**
 * POST /api/v1/food-log/voice
 * Body: { text: "transcribed voice string" }
 */
const voiceLog = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await FoodLogService.voiceLog(
    userId,
    req.body,
    extractClientMeta(req),
  );
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Voice meal logged successfully",
    data: result,
  });
});

/**
 * POST /api/v1/food-log/barcode
 * Body: { barcode, mealType, quantity?, unit? }
 *
 * Flow:
 *  1. POST /scan/barcode  → product_name
 *  2. POST /food/parse    → usda_id
 *  3. POST /log/food      → updated score
 *  4. Save to DB
 */
const barcodeLog = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await FoodLogService.barcodeLog(
    userId,
    req.body,
    extractClientMeta(req),
  );
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Barcode scanned and meal logged successfully",
    data: result,
  });
});

/**
 * GET /api/v1/food-log?date=YYYY-MM-DD&mealType=Breakfast&page=1&limit=20
 */
const getMyLogs = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await FoodLogService.getMyLogs(userId, req.query as any);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Food logs retrieved successfully",
    data: result,
  });
});

export const FoodLogController = {
  manualLog,
  voiceLog,
  barcodeLog,
  getMyLogs,
};
