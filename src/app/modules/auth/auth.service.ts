/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import appleSignin from "apple-signin-auth";

import { User } from "../user/user.model";
import AppError from "../../error/appError";
// import { generateOtp } from "../../../utilities/generateOtp";
import {
  ISignUp,
  ISignIn,
  IForgotPassword,
  IVerifyOtp,
  IResetPassword,
  ISocialAuth,
  IPatientHealthInfo,
  IPatientFoodSensitivities,
  IPatientSymptoms,
  IClinicianProfile,
  ITokenPayload,
} from "./auth.interface";
import config from "../../config";
import { generateOtp } from "../../utilities/generateOtp";
import sendEmail from "../../utilities/sendEmail";
// import { constants } from "fs/promises";

const googleClient = new OAuth2Client(config.google_client_id);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const signToken = (payload: ITokenPayload, rememberMe = false): string => {
  return jwt.sign(payload, config.jwt_access_secret as string, {
    expiresIn: rememberMe ? "30d" : (config.jwt_access_expires_in as any),
  });
};

// ─── Patient Sign-up ─────────────────────────────────────────────────────────

const patientSignUp = async (payload: ISignUp) => {
  const existing = await User.findOne({ email: payload.email });
  if (existing) throw new AppError(409, "Email is already registered");

  const user = await User.create({
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: "patient",
    patientProfile: {},
  });

  const token = signToken({
    userId: String(user._id),
    role: user.role,
    email: user.email,
  });
  return { token, user: sanitize(user) };
};

// ─── Clinician Sign-up ────────────────────────────────────────────────────────

const clinicianSignUp = async (payload: ISignUp) => {
  const existing = await User.findOne({ email: payload.email });
  if (existing) throw new AppError(409, "Email is already registered");

  const user = await User.create({
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: "clinician",
    clinicianProfile: { isProfileComplete: false },
  });

  const token = signToken({
    userId: String(user._id),
    role: user.role,
    email: user.email,
  });
  return { token, user: sanitize(user) };
};

// ─── Sign-in (shared) ─────────────────────────────────────────────────────────

const signIn = async (payload: ISignIn) => {
  const user = await User.findOne({ email: payload.email }).select("+password");
  if (!user) throw new AppError(401, "Invalid email or password");

  if (user.isDeleted) {
    throw new AppError(
      402,
      "Your account has been deleted. Please contact support if this is a mistake.",
    );
  }

  if (!user.isActive)
    throw new AppError(402, "Your account has been deactivated");

  if (user.authProvider !== "local")
    throw new AppError(400, `Please sign in with ${user.authProvider}`);

  const isMatch = await user.matchPassword(payload.password);
  if (!isMatch) throw new AppError(401, "Invalid email or password");

  // CHECK PATIENT ONBOARDING
  if (user.role === "patient") {
    const profile = user.patientProfile;

    const isIncomplete =
      !profile ||
      !profile.gender ||
      !profile.age ||
      !profile.sleepAvg ||
      !profile.weight ||
      profile.foodSensitivities?.length === 0 ||
      profile.symptoms?.length === 0;

    if (isIncomplete) {
      throw new AppError(403, "Please complete your profile information first");
    }
  } else if (user.role === "clinician") {
    const profile = user.clinicianProfile;
    if (!profile || !profile.isProfileComplete) {
      throw new AppError(403, "Please complete your profile information first");
    }
  }

  const token = signToken(
    { userId: String(user._id), role: user.role, email: user.email },
    payload.rememberMe,
  );

  return { token, user: sanitize(user) };
};

// ─── Forgot Password ─────────────────────────────────────────────────────────

const forgotPassword = async (payload: IForgotPassword) => {
  const user = await User.findOne({ email: payload.email });
  if (!user) throw new AppError(404, "No account found with this email");

  const otp = generateOtp();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await User.findByIdAndUpdate(user._id, { otp, otpExpiry });

  await sendEmail({
    email: user.email,
    subject: "Yugayo – Password Reset OTP",
    html: `
      <h2>Password Reset Request</h2>
      <p>Use the OTP below to reset your password. It expires in <strong>10 minutes</strong>.</p>
      <h1 style="letter-spacing:8px;">${otp}</h1>
      <p>If you did not request this, please ignore this email.</p>
    `,
  });

  return { message: "OTP sent to your email" };
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────

const verifyOtp = async (payload: IVerifyOtp) => {
  const user = await User.findOne({ email: payload.email }).select(
    "+otp +otpExpiry",
  );
  if (!user) throw new AppError(404, "User not found");
  if (!user.otp || !user.otpExpiry)
    throw new AppError(400, "No OTP found, request a new one");
  if (user.otp !== payload.otp) throw new AppError(400, "Invalid OTP");
  if (user.otpExpiry < new Date()) throw new AppError(400, "OTP has expired");

  // Generate a short-lived reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  await User.findByIdAndUpdate(user._id, {
    otp: undefined,
    otpExpiry: undefined,
    passwordResetToken: resetToken,
    passwordResetExpiry: resetExpiry,
  });

  return { resetToken };
};

// ─── Reset Password ───────────────────────────────────────────────────────────

const resetPassword = async (payload: IResetPassword) => {
  const user = await User.findOne({ email: payload.email }).select(
    "+passwordResetToken +passwordResetExpiry",
  );
  if (!user) throw new AppError(404, "User not found");
  if (!user.passwordResetToken || !user.passwordResetExpiry)
    throw new AppError(400, "Reset token not found, please request again");
  if (user.passwordResetExpiry < new Date())
    throw new AppError(400, "Reset token has expired");

  user.password = payload.newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpiry = undefined;
  await user.save();

  return { message: "Password reset successfully" };
};

// ─── Google Sign-in / Sign-up ─────────────────────────────────────────────────

const googleAuth = async (payload: ISocialAuth) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: payload.idToken,
    audience: [
      config.web_client_id,
      config.debug_android_client_id,
      config.release_android_client_id,
    ],
  });

  const googlePayload = ticket.getPayload();
  if (!googlePayload) throw new AppError(400, "Invalid Google token");

  const { sub: googleId, email, name } = googlePayload;
  if (!email) throw new AppError(400, "Google account has no email");

  let user = await User.findOne({ $or: [{ googleId }, { email }] });
  let isNewUser = false;

  if (user) {
    if (user.isDeleted)
      throw new AppError(
        402,
        "Your account has been deleted. Please contact support if this is a mistake.",
      );

    if (user.authProvider === "local")
      throw new AppError(
        400,
        "An account with this email already exists. Please sign in with your password.",
      );
    if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }
  } else {
    if (!payload.role) throw new AppError(400, "Role is required for sign-up");

    user = await User.create({
      name,
      email,
      googleId,
      authProvider: "google",
      role: payload.role,
      isVerified: true,
      patientProfile: payload.role === "patient" ? {} : undefined,
      clinicianProfile:
        payload.role === "clinician" ? { isProfileComplete: false } : undefined,
    });
    isNewUser = true;
  }

  if (!user.isActive)
    throw new AppError(402, "Your account has been deactivated");

  const token = signToken({
    userId: String(user._id),
    role: user.role,
    email: user.email,
  });

  // New users always need onboarding — return token so they can call
  // the protected onboarding endpoints, but flag it for the frontend.
  if (isNewUser) {
    return {
      token,
      user: sanitize(user),
      isNewUser: true,
      needsOnboarding: true,
    };
  }

  // Returning patient — block if onboarding was never finished
  if (user.role === "patient") {
    const p = user.patientProfile;
    const isIncomplete =
      !p ||
      !p.gender ||
      !p.age ||
      !p.sleepAvg ||
      !p.weight ||
      !p.foodSensitivities?.length ||
      !p.symptoms?.length;

    if (isIncomplete)
      throw new AppError(403, "Please complete your profile information first");
  }

  // Returning clinician — block if profile was never finished
  if (user.role === "clinician" && !user.clinicianProfile?.isProfileComplete)
    throw new AppError(403, "Please complete your clinician profile first");

  return {
    token,
    user: sanitize(user),
    isNewUser: false,
    needsOnboarding: false,
  };
};

// ─── Apple Sign-in / Sign-up ──────────────────────────────────────────────────

const appleAuth = async (payload: ISocialAuth) => {
  const applePayload = await appleSignin.verifyIdToken(payload.idToken, {
    audience: config.apple_client_id,
    ignoreExpiration: false,
  });

  const { sub: appleId, email } = applePayload;
  if (!email) throw new AppError(400, "Apple account has no email");

  let user = await User.findOne({ $or: [{ appleId }, { email }] });
  let isNewUser = false;

  if (user) {
    if (user.authProvider === "local")
      throw new AppError(
        400,
        "An account with this email already exists. Please sign in with your password.",
      );
    if (!user.appleId) {
      user.appleId = appleId;
      await user.save();
    }
  } else {
    if (!payload.role) throw new AppError(400, "Role is required for sign-up");

    user = await User.create({
      email,
      appleId,
      authProvider: "apple",
      role: payload.role,
      isVerified: true,
      patientProfile: payload.role === "patient" ? {} : undefined,
      clinicianProfile:
        payload.role === "clinician" ? { isProfileComplete: false } : undefined,
    });
    isNewUser = true;
  }

  if (!user.isActive)
    throw new AppError(402, "Your account has been deactivated");

  // ── Onboarding check (sign-in path only) ──────────────────────────────────
  if (!isNewUser) {
    if (user.role === "patient") {
      const profile = user.patientProfile;
      const isIncomplete =
        !profile ||
        !profile.gender ||
        !profile.age ||
        !profile.sleepAvg ||
        !profile.weight ||
        !profile.foodSensitivities?.length ||
        !profile.symptoms?.length;

      if (isIncomplete)
        throw new AppError(
          403,
          "Please complete your profile information first",
        );
    }

    if (user.role === "clinician") {
      if (!user.clinicianProfile?.isProfileComplete)
        throw new AppError(403, "Please complete your clinician profile first");
    }
  }

  const token = signToken({
    userId: String(user._id),
    role: user.role,
    email: user.email,
  });

  return { token, user: sanitize(user), isNewUser };
};

// ─── Patient Onboarding ───────────────────────────────────────────────────────

const savePatientHealthInfo = async (
  userId: string,
  payload: IPatientHealthInfo,
) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { patientProfile: { ...payload } },
    { new: true, runValidators: true },
  );
  if (!user) throw new AppError(404, "User not found");
  return sanitize(user);
};

const savePatientFoodSensitivities = async (
  userId: string,
  payload: IPatientFoodSensitivities,
) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { "patientProfile.foodSensitivities": payload.foodSensitivities },
    { new: true, runValidators: true },
  );
  if (!user) throw new AppError(404, "User not found");
  return sanitize(user);
};

const savePatientSymptoms = async (
  userId: string,
  payload: IPatientSymptoms,
) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { "patientProfile.symptoms": payload.symptoms },
    { new: true, runValidators: true },
  );
  if (!user) throw new AppError(404, "User not found");
  return sanitize(user);
};

// ─── Clinician Profile Completion ─────────────────────────────────────────────

const saveClinicianProfile = async (
  userId: string,
  payload: IClinicianProfile,
) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { clinicianProfile: { ...payload, isProfileComplete: true } },
    { new: true, runValidators: true },
  );
  if (!user) throw new AppError(404, "User not found");
  return sanitize(user);
};

const getMe = async (userId: string) => {
  console.log(userId);
  const user = await User.findById(userId)
    .select(
      "-password -otp -otpExpiry -passwordResetToken -passwordResetExpiry",
    )
    .lean();

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return sanitize(user);
};

const changePassword = async (
  userId: string,
  payload: { oldPassword: string; newPassword: string },
) => {
  const user = await User.findById(userId).select("+password");
  if (!user) throw new AppError(404, "User not found");

  if (user.authProvider !== "local")
    throw new AppError(
      400,
      `Password change is not available for ${user.authProvider} accounts`,
    );

  const isMatch = await user.matchPassword(payload.oldPassword);
  if (!isMatch) throw new AppError(401, "Old password is incorrect");

  user.password = payload.newPassword;
  await user.save();

  return { message: "Password changed successfully" };
};

// ─── Utility ─────────────────────────────────────────────────────────────────

const sanitize = (user: any) => {
  const obj = typeof user.toObject === "function" ? user.toObject() : user;

  delete obj.password;
  delete obj.otp;
  delete obj.otpExpiry;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpiry;

  return obj;
};

const deleteMyAccount = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user) throw new AppError(404, "User not found");

  user.isDeleted = true;
  user.deletedAt = new Date();
  user.isActive = false;

  await user.save();

  return null;
};

export const AuthService = {
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
