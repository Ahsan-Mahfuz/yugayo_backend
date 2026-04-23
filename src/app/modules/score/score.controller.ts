/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { getPatientDetails, ScoreService } from "./score.service";

// ─── Patient ──────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/score/calculate
 * Call once after onboarding is complete.
 * Reads profile from DB, hits Python AI, stores result.
 */
const calculateScore = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await ScoreService.calculateOnboardingScore(userId);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Gut health score calculated successfully",
    data: result,
  });
});

/**
 * GET /api/v1/score/me
 * Patient sees their own score + breakdown + recommendations.
 */
const getMyScore = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await ScoreService.getMyScore(userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Score retrieved successfully",
    data: result,
  });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/score/admin/all
 * Admin sees all users' scores with pagination + filters.
 */
const getAllScores = catchAsync(async (req: Request, res: Response) => {
  const query = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    grade: req.query.grade as string | undefined,
    minScore: req.query.minScore ? Number(req.query.minScore) : undefined,
    maxScore: req.query.maxScore ? Number(req.query.maxScore) : undefined,
  };
  const result = await ScoreService.getAllScores(query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All scores retrieved successfully",
    data: result,
  });
});

/**
 * GET /api/v1/score/admin/user/:userId
 * Admin sees a specific user's full score detail.
 */
const getScoreByUserId = catchAsync(async (req: Request, res: Response) => {
  const result = await ScoreService.getScoreByUserId(req.params.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User score retrieved successfully",
    data: result,
  });
});

const getPatients = catchAsync(async (req: Request, res: Response) => {
  const result = await ScoreService.getPatientsWithStatus();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Patients retrieved successfully",
    data: result,
  });
});
export const getPatientDetailsController = catchAsync(async (req, res) => {
  const result = await getPatientDetails(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Patient details fetched successfully",
    data: result,
  });
});

export const ScoreController = {
  calculateScore,
  getMyScore,
  getAllScores,
  getScoreByUserId,
  getPatients,
  getPatientDetailsController,
};
