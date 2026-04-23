/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { ConnectionService } from "./connection.service";

// Patient sends a connection request to a clinician
const sendRequest = catchAsync(async (req: Request, res: Response) => {
  const patientId = (req as any).user.userId;
  const { clinicianId } = req.body;
  const result = await ConnectionService.sendRequest(patientId, clinicianId);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Connection request sent successfully",
    data: result,
  });
});

// Admin: get all connections with stats
const getAllConnections = catchAsync(async (req: Request, res: Response) => {
  const result = await ConnectionService.getAllConnections(req.query as any);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Connections retrieved successfully",
    data: result,
  });
});

// Admin: accept or reject a request
const respondToRequest = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req as any).user.userId;
  const { connectionId } = req.params;
  const { status, rejectionReason } = req.body;
  const result = await ConnectionService.respondToRequest(
    connectionId,
    adminId,
    status,
    rejectionReason,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Connection ${status === "active" ? "accepted" : "rejected"} successfully`,
    data: result,
  });
});

// Patient: get my connections
const getMyConnections = catchAsync(async (req: Request, res: Response) => {
  const patientId = (req as any).user.userId;
  const result = await ConnectionService.getMyConnections(patientId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Connections retrieved",
    data: result,
  });
});

// Clinician: get my connected patients
const getClinicianConnections = catchAsync(
  async (req: Request, res: Response) => {
    const clinicianId = (req as any).user.userId;
    const result = await ConnectionService.getClinicianConnections(clinicianId);
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Connected patients retrieved",
      data: result,
    });
  },
);

// Patient: browse all clinicians
const getAllClinicians = catchAsync(async (req: Request, res: Response) => {
  const patientId = (req as any).user.userId;

  const result = await ConnectionService.getAllClinicians(
    patientId,
    req.query as any,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Clinicians retrieved",
    data: result,
  });
});

export const ConnectionController = {
  sendRequest,
  getAllConnections,
  respondToRequest,
  getMyConnections,
  getClinicianConnections,
  getAllClinicians,
};
