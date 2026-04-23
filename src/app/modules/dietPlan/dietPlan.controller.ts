/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { DietPlanService } from "./dietPlan.service";

const userId = (req: Request) => (req as any).user.userId;

/**
 * POST /api/v1/clinician/patients/:patientId/diet-plan
 * Clinician creates a new diet plan + notifies patient
 */
const createDietPlan = catchAsync(async (req: Request, res: Response) => {
  const result = await DietPlanService.createDietPlan(
    userId(req),
    req.params.patientId,
    req.body
  );
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Diet plan created and patient notified",
    data: result,
  });
});

/**
 * PATCH /api/v1/clinician/patients/:patientId/diet-plan
 * Clinician updates existing diet plan
 */
const updateDietPlan = catchAsync(async (req: Request, res: Response) => {
  const result = await DietPlanService.updateDietPlan(
    userId(req),
    req.params.patientId,
    req.body
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Diet plan updated successfully",
    data: result,
  });
});

/**
 * GET /api/v1/clinician/patients/:patientId/diet-plan
 * Clinician views the active diet plan for a patient
 */
const getDietPlan = catchAsync(async (req: Request, res: Response) => {
  const result = await DietPlanService.getDietPlan(
    userId(req),
    req.params.patientId
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Diet plan retrieved",
    data: result,
  });
});

/**
 * GET /api/v1/diet-plan/my
 * Patient views their own diet plan
 */
const getMyDietPlan = catchAsync(async (req: Request, res: Response) => {
  const result = await DietPlanService.getMyDietPlan(userId(req));
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Your diet plan retrieved",
    data: result,
  });
});

export const DietPlanController = {
  createDietPlan,
  updateDietPlan,
  getDietPlan,
  getMyDietPlan,
};