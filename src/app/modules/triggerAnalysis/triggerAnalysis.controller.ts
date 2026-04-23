/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { TriggerAnalysisService } from "./triggerAnalysis.service";

/**
 * POST /api/v1/triggers/generate
 * Patient triggers full risky food + trigger insight analysis
 * Query: ?days=90 (default 90 — 3 months)
 *
 * Flow:
 *  1. Fetch food logs + symptom logs from last N days
 *  2. POST /recommend/risky_food → predictions { symptom: [foods] }
 *  3. For each symptom → POST /recommend/triggers_food → insight
 *  4. Save to DB + return
 */
const generateTriggerAnalysis = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const days = req.query.days ? Number(req.query.days) : 90;
    const result = await TriggerAnalysisService.generateTriggerAnalysis(
      userId,
      { days },
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Trigger analysis generated successfully",
      data: result,
    });
  },
);

/**
 * GET /api/v1/triggers/my
 * Patient views their latest saved trigger analysis
 */
const getMyTriggerAnalysis = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await TriggerAnalysisService.getMyTriggerAnalysis(userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trigger analysis retrieved",
    data: result,
  });
});

/**
 * GET /api/v1/clinician/patients/:patientId/triggers-analysis
 * Clinician views a connected patient's trigger analysis
 */
const getPatientTriggerAnalysis = catchAsync(
  async (req: Request, res: Response) => {
    const clinicianId = (req as any).user.userId;
    const result = await TriggerAnalysisService.getPatientTriggerAnalysis(
      clinicianId,
      req.params.patientId,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Patient trigger analysis retrieved",
      data: result,
    });
  },
);

export const TriggerAnalysisController = {
  generateTriggerAnalysis,
  getMyTriggerAnalysis,
  getPatientTriggerAnalysis,
};
