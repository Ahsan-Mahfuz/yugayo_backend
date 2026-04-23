/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { ClinicianDashboardService } from "./clinicianDashboard.service";

// ─── Helper: safely extract clinician ID from req.user ───────────────────────
// Handles all common auth middleware patterns:
//   req.user._id   (mongoose document attached directly)
//   req.user.id    (plain object with string id)
//   req.user.userId
const getClinicianId = (req: Request): string => {
  const user = req.user as any;
  if (!user) throw new Error("Unauthorized: no user on request");

  const id = user._id ?? user.id ?? user.userId;
  if (!id) throw new Error("Unauthorized: user id not found");

  return id.toString();
};

// ─── Dashboard Summary ────────────────────────────────────────────────────────
const getDashboardSummary = catchAsync(async (req: Request, res: Response) => {
  const clinicianId = getClinicianId(req);
  const result =
    await ClinicianDashboardService.getDashboardSummary(clinicianId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dashboard summary fetched",
    data: result,
  });
});

// ─── Recent Alerts ────────────────────────────────────────────────────────────
const getRecentAlerts = catchAsync(async (req: Request, res: Response) => {
  const clinicianId = getClinicianId(req);
  const result = await ClinicianDashboardService.getRecentAlerts(clinicianId, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
  });
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Recent alerts fetched",
    data: result,
  });
});

// ─── Recent Activity ──────────────────────────────────────────────────────────
const getRecentActivity = catchAsync(async (req: Request, res: Response) => {
  const clinicianId = getClinicianId(req);
  const result = await ClinicianDashboardService.getRecentActivity(
    clinicianId,
    {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    },
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Recent activity fetched",
    data: result,
  });
});

// ─── At-Risk Patients ─────────────────────────────────────────────────────────
const getAtRiskPatients = catchAsync(async (req: Request, res: Response) => {
  const clinicianId = getClinicianId(req);
  const result = await ClinicianDashboardService.getAtRiskPatients(clinicianId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "At-risk patients fetched",
    data: result,
  });
});

// ─── My Patients ──────────────────────────────────────────────────────────────
const getMyPatients = catchAsync(async (req: Request, res: Response) => {
  const clinicianId = getClinicianId(req);

  const rawStatus = req.query.status as string | undefined;
  const validStatuses = ["stable", "at-risk", "flare-up"];
  const status =
    rawStatus && validStatuses.includes(rawStatus)
      ? (rawStatus as "stable" | "at-risk" | "flare-up")
      : undefined;

  const result = await ClinicianDashboardService.getMyPatients(clinicianId, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    search: req.query.search as string | undefined,
    status,
  });
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Patients fetched",
    data: result,
  });
});

// ─── Patient Overview ─────────────────────────────────────────────────────────
const getPatientOverview = catchAsync(async (req: Request, res: Response) => {
  const clinicianId = getClinicianId(req);
  const result = await ClinicianDashboardService.getPatientOverview(
    clinicianId,
    req.params.patientId,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Patient overview fetched",
    data: result,
  });
});

// ─── Patient Food Logs ────────────────────────────────────────────────────────
const getPatientFoodLogs = catchAsync(async (req: Request, res: Response) => {
  const clinicianId = getClinicianId(req);
  const result = await ClinicianDashboardService.getPatientFoodLogs(
    clinicianId,
    req.params.patientId,
    {
      date: req.query.date as string | undefined,
      mealType: req.query.mealType as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    },
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Patient food logs fetched",
    data: result,
  });
});

// ─── Patient Symptoms ─────────────────────────────────────────────────────────
const getPatientSymptoms = catchAsync(async (req: Request, res: Response) => {
  const clinicianId = getClinicianId(req);
  const result = await ClinicianDashboardService.getPatientSymptoms(
    clinicianId,
    req.params.patientId,
    {
      date: req.query.date as string | undefined,
      severity: req.query.severity as string | undefined, // "Mild" | "Moderate" | "Severe"
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    },
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Patient symptoms fetched",
    data: result,
  });
});

// ─── Patient Triggers ─────────────────────────────────────────────────────────
const getPatientTriggers = catchAsync(async (req: Request, res: Response) => {
  const clinicianId = getClinicianId(req);
  const result = await ClinicianDashboardService.getPatientTriggers(
    clinicianId,
    req.params.patientId,
    { days: Number(req.query.days) || 30 },
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Patient triggers fetched",
    data: result,
  });
});

// ─── Patient Weekly Trend ─────────────────────────────────────────────────────
const getPatientWeeklyTrend = catchAsync(
  async (req: Request, res: Response) => {
    const clinicianId = getClinicianId(req);
    const result = await ClinicianDashboardService.getPatientWeeklyTrend(
      clinicianId,
      req.params.patientId,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Patient weekly trend fetched",
      data: result,
    });
  },
);

export const ClinicianDashboardController = {
  getDashboardSummary,
  getRecentAlerts,
  getRecentActivity,
  getAtRiskPatients,
  getMyPatients,
  getPatientOverview,
  getPatientFoodLogs,
  getPatientSymptoms,
  getPatientTriggers,
  getPatientWeeklyTrend,
};
