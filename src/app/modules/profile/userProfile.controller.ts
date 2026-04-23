/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { UserProfileService } from "./userProfile.service";
import AppError from "../../error/appError";

// ─── PATCH /api/v1/user/profile/picture ──────────────────────────────────────
// FormData field: profilePicture (file)
const updateProfilePicture = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  if (!req.file) {
    throw new AppError(
      400,
      "No image file provided. Send file as 'profilePicture' in FormData.",
    );
  }

  const result = await UserProfileService.updateProfilePicture(
    userId,
    req.file,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile picture updated successfully",
    data: result,
  });
});

// ─── PATCH /api/v1/user/profile ───────────────────────────────────────────────
// Accepts multipart/form-data OR application/json
// Optional file field: profilePicture
// Text fields depend on role:
//   Shared:    name
//   Patient:   gender, age, sleepAvg, weight, isEliminationStage
//   Clinician: department, phone, location
const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  // Parse numeric / boolean fields that come as strings from FormData
  const raw = req.body;
  const payload: Record<string, any> = {};

  if (raw.name !== undefined) payload.name = raw.name;

  // Patient fields
  if (raw.gender !== undefined) payload.gender = raw.gender;
  if (raw.age !== undefined) payload.age = Number(raw.age);
  if (raw.sleepAvg !== undefined) payload.sleepAvg = Number(raw.sleepAvg);
  if (raw.weight !== undefined) payload.weight = Number(raw.weight);
  if (raw.isEliminationStage !== undefined) {
    payload.isEliminationStage =
      raw.isEliminationStage === "true" || raw.isEliminationStage === true;
  }

  // Clinician fields
  if (raw.department !== undefined) payload.department = raw.department;
  if (raw.phone !== undefined) payload.phone = raw.phone;
  if (raw.location !== undefined) payload.location = raw.location;

  const result = await UserProfileService.updateProfile(
    userId,
    payload,
    req.file, // optional picture upload
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

export const UserProfileController = {
  updateProfilePicture,
  updateProfile,
};
