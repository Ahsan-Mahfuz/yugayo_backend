/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";

// ─── Sign-up ─────────────────────────────────────────────────────────────────

const patientSignUp = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.patientSignUp(req.body);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Patient registered successfully",
    data: result,
  });
});

const clinicianSignUp = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.clinicianSignUp(req.body);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Clinician registered successfully",
    data: result,
  });
});

// ─── Sign-in ─────────────────────────────────────────────────────────────────

const signIn = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.signIn(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Signed in successfully",
    data: result,
  });
});

// ─── Forgot / Reset password ──────────────────────────────────────────────────

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.forgotPassword(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: null,
  });
});

const verifyOtp = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.verifyOtp(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "OTP verified successfully",
    data: result,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.resetPassword(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: null,
  });
});

// ─── Social auth ─────────────────────────────────────────────────────────────

const googleAuth = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.googleAuth(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Google authentication successful",
    data: result,
  });
});

const appleAuth = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.appleAuth(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Apple authentication successful",
    data: result,
  });
});

// ─── Patient Onboarding ───────────────────────────────────────────────────────

const savePatientHealthInfo = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const result = await AuthService.savePatientHealthInfo(userId, req.body);
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Health information saved successfully",
      data: result,
    });
  },
);

const savePatientFoodSensitivities = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const result = await AuthService.savePatientFoodSensitivities(
      userId,
      req.body,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Food sensitivities saved successfully",
      data: result,
    });
  },
);

const savePatientSymptoms = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await AuthService.savePatientSymptoms(userId, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Symptoms saved successfully",
    data: result,
  });
});

// ─── Clinician Profile Completion ─────────────────────────────────────────────

const saveClinicianProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await AuthService.saveClinicianProfile(userId, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Clinician profile saved successfully",
    data: result,
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  const result = await AuthService.getMe(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User retrieved successfully",
    data: result,
  });
});

const deleteMyAccount = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  const result = await AuthService.deleteMyAccount(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Account deleted successfully",
    data: result,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await AuthService.changePassword(userId, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: null,
  });
});

export const AuthController = {
  patientSignUp,
  clinicianSignUp,
  signIn,
  forgotPassword,
  verifyOtp,
  resetPassword,
  googleAuth,
  appleAuth,
  savePatientHealthInfo,
  savePatientFoodSensitivities,
  savePatientSymptoms,
  saveClinicianProfile,
  getMe,
  deleteMyAccount,
  changePassword,
};
