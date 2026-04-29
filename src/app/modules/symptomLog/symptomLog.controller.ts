/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { SymptomLogService } from "./symptomLog.service";

const extractClientMeta = (req: Request) => ({
  timezone: (req.headers["x-timezone"] as string) || undefined,
  utcOffsetMinutes: req.headers["x-utc-offset-minutes"]
    ? Number(req.headers["x-utc-offset-minutes"])
    : undefined,
  country: (req.headers["x-country-code"] as string) || undefined,
});

/**
 * POST /api/v1/symptom-log
 * Body: { symptoms, severity, note?, loggedAt? }
 */
const logSymptoms = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await SymptomLogService.logSymptoms(
    userId,
    req.body,
    extractClientMeta(req),
  );
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Symptoms logged successfully",
    data: result,
  });
});

/**
 * GET /api/v1/symptom-log?date=YYYY-MM-DD&page=1&limit=20
 */
const getMySymptomLogs = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await SymptomLogService.getMySymptomLogs(
    userId,
    req.query as any,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Symptom logs retrieved successfully",
    data: result,
  });
});

/**
 * GET /api/v1/symptom-log/:id
 * Get a single symptom log by ID
 */
const getSymptomLogById = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await SymptomLogService.getSymptomLogById(
    userId,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Symptom log retrieved successfully",
    data: result,
  });
});

/**
 * GET /api/v1/symptom-log/trend/weekly
 * Last 7 days symptom breakdown for the line/bar chart
 */
const getWeeklyTrend = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await SymptomLogService.getWeeklyTrend(userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Weekly symptom trend retrieved",
    data: result,
  });
});

export const SymptomLogController = {
  logSymptoms,
  getMySymptomLogs,
  getSymptomLogById,
  getWeeklyTrend,
};
