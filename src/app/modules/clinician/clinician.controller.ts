/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { ClinicianService } from "./clinician.service";

const clinicianId = (req: Request) => (req as any).user.userId;

const getMyPatients = catchAsync(async (req: Request, res: Response) => {
  const result = await ClinicianService.getMyPatients(
    clinicianId(req),
    req.query as any,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Patients retrieved successfully",
    data: result,
  });
});

const getPatientOverview = catchAsync(async (req: Request, res: Response) => {
  const result = await ClinicianService.getPatientOverview(
    clinicianId(req),
    req.params.patientId,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Patient overview retrieved",
    data: result,
  });
});

const getPatientFoodLogs = catchAsync(async (req: Request, res: Response) => {
  const result = await ClinicianService.getPatientFoodLogs(
    clinicianId(req),
    req.params.patientId,
    req.query as any,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Food logs retrieved",
    data: result,
  });
});

const getPatientSymptoms = catchAsync(async (req: Request, res: Response) => {
  const result = await ClinicianService.getPatientSymptoms(
    clinicianId(req),
    req.params.patientId,
    req.query as any,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Symptom logs retrieved",
    data: result,
  });
});

const getPatientTriggers = catchAsync(async (req: Request, res: Response) => {
  const result = await ClinicianService.getPatientTriggers(
    clinicianId(req),
    req.params.patientId,
    req.query as any,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trigger analysis retrieved",
    data: result,
  });
});

/**
 * GET /api/v1/clinician/patients/:patientId/trend/weekly
 * Clinician views a patient's weekly symptom trend (same data as patient sees for themselves)
 */
const getPatientWeeklyTrend = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ClinicianService.getPatientWeeklyTrend(
      clinicianId(req),
      req.params.patientId,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Patient weekly symptom trend retrieved",
      data: result,
    });
  },
);

export const ClinicianController = {
  getMyPatients,
  getPatientOverview,
  getPatientFoodLogs,
  getPatientSymptoms,
  getPatientTriggers,
  getPatientWeeklyTrend, // ← new
};
