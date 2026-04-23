import express from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { auth } from "../../middleware/auth";
import {
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  socialAuthSchema,
  patientHealthInfoSchema,
  patientFoodSensitivitiesSchema,
  patientSymptomsSchema,
  clinicianProfileSchema,
  changePasswordSchema,
} from "./auth.validation";
import { AuthController } from "./auth.controller";

const router = express.Router();

// ─── Public routes ────────────────────────────────────────────────────────────

// Sign-up
router.post(
  "/patient/signup",
  validateRequest(signUpSchema),
  AuthController.patientSignUp,
);
router.post(
  "/clinician/signup",
  validateRequest(signUpSchema),
  AuthController.clinicianSignUp,
);

// Sign-in (both roles use the same endpoint)
router.post("/signin", validateRequest(signInSchema), AuthController.signIn);

// Forgot / Reset password flow
router.post(
  "/forgot-password",
  validateRequest(forgotPasswordSchema),
  AuthController.forgotPassword,
);
router.post(
  "/verify-otp",
  validateRequest(verifyOtpSchema),
  AuthController.verifyOtp,
);
router.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  AuthController.resetPassword,
);

router.post(
  "/change-password",
  auth("patient", "clinician", "admin"),
  validateRequest(changePasswordSchema),
  AuthController.changePassword,
);

// Social auth
router.post(
  "/google",
  validateRequest(socialAuthSchema),
  AuthController.googleAuth,
);
router.post(
  "/apple",
  validateRequest(socialAuthSchema),
  AuthController.appleAuth,
);

// ─── Protected routes (require valid JWT) ─────────────────────────────────────

// Patient onboarding steps
router.post(
  "/patient/health-info",
  auth("patient"),
  validateRequest(patientHealthInfoSchema),
  AuthController.savePatientHealthInfo,
);

router.post(
  "/patient/food-sensitivities",
  auth("patient"),
  validateRequest(patientFoodSensitivitiesSchema),
  AuthController.savePatientFoodSensitivities,
);

router.post(
  "/patient/symptoms",
  auth("patient"),
  validateRequest(patientSymptomsSchema),
  AuthController.savePatientSymptoms,
);

// Clinician profile completion
router.post(
  "/clinician/profile",
  auth("clinician"),
  validateRequest(clinicianProfileSchema),
  AuthController.saveClinicianProfile,
);

router.get("/me", auth("patient", "clinician", "admin"), AuthController.getMe);

router.delete(
  "/me",
  auth("patient", "clinician", "admin"),
  AuthController.deleteMyAccount,
);

export const AuthRoutes = router;
