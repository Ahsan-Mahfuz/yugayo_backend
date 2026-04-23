import { Document, Types } from "mongoose";

export type TRole = "patient" | "clinician" | "admin";
export type TAuthProvider = "local" | "google" | "apple";

// ─── Patient-specific fields ────────────────────────────────────────────────
export interface IPatientProfile {
  gender?: string;
  age?: number;
  sleepAvg?: number;
  weight?: number;
  isEliminationStage?: boolean;
  foodSensitivities?: string[];
  symptoms?: string[];
}

// ─── Clinician-specific fields ───────────────────────────────────────────────
export interface IClinicianProfile {
  department?: string;
  phone?: string;
  location?: string;
  isProfileComplete?: boolean;
}

// ─── Core User ───────────────────────────────────────────────────────────────
export interface IUser extends Document {
  _id: Types.ObjectId;
  name?: string;
  email: string;
  password?: string;
  role: TRole;
  authProvider: TAuthProvider;
  googleId?: string;
  appleId?: string;
  isVerified: boolean;
  isActive: boolean;
  rememberMe?: boolean;

  // Profile picture — relative URL path e.g. /uploads/profile/profile-123.jpg
  profilePicture?: string | null;

  // Profile sub-docs
  patientProfile?: IPatientProfile;
  clinicianProfile?: IClinicianProfile;

  // OTP / password reset
  otp?: string;
  otpExpiry?: Date;
  passwordResetToken?: string;
  passwordResetExpiry?: Date;

  createdAt: Date;
  updatedAt: Date;

  isDeleted?: boolean;
  deletedAt?: Date;

  // instance method
  matchPassword(plain: string): Promise<boolean>;
}
