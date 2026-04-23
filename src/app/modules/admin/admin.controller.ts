/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { AdminService } from "./admin.service";

const getAllClinicians = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getAllClinicians(req.query as any);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Clinicians retrieved successfully",
    data: result,
  });
});

const getClinicianDetails = catchAsync(async (req, res) => {
  const result = await AdminService.getClinicianDetails(req.params.clinicianId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Clinician details retrieved successfully",
    data: result,
  });
});

export const AdminController = {
  getAllClinicians,
  getClinicianDetails,
};
