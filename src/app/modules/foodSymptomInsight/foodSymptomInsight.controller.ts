/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { SymptomFoodReportService } from "./foodSymptomInsight.service";

/**
 * GET /api/v1/symptom-food-report?days=7
 * Patient — own report, days param required (7 or 30)
 */
const getMyReport = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const days = parseInt(req.query.days as string) || 7;

  const result = await SymptomFoodReportService.getSymptomFoodReport(
    userId,
    days,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Symptom–food report for last ${days} days retrieved successfully`,
    data: result,
  });
});

/**
 * GET /api/v1/symptom-food-report/patient/:patientId?days=30
 * Clinician — specific patient
 */
const getPatientReport = catchAsync(async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const days = parseInt(req.query.days as string) || 7;

  const result = await SymptomFoodReportService.getPatientSymptomFoodReport(
    patientId,
    days,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Patient symptom–food report for last ${days} days retrieved successfully`,
    data: result,
  });
});

export const SymptomFoodReportController = {
  getMyReport,
  getPatientReport,
};
