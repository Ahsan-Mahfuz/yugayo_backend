import { TRole } from "../user/user.interface";

export interface ISignUp {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: TRole;
  agreedToTerms: boolean;
}

export interface ISignIn {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface IForgotPassword {
  email: string;
}

export interface IVerifyOtp {
  email: string;
  otp: string;
}

export interface IResetPassword {
  email: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ISocialAuth {
  idToken: string; // token from Google / Apple SDK
  role: TRole;
}

// Patient onboarding (step 1 – health info)
export interface IPatientHealthInfo {
  gender: string;
  age: number;
  sleepAvg: number;
  weight: number;
  isEliminationStage: boolean;
}

// Patient onboarding (step 2 – food sensitivities)
export interface IPatientFoodSensitivities {
  foodSensitivities: string[];
}

// Patient onboarding (step 3 – symptoms)
export interface IPatientSymptoms {
  symptoms: string[];
}

// Clinician profile completion
export interface IClinicianProfile {
  department: string;
  phone: string;
  location: string;
}

export interface ITokenPayload {
  userId: string;
  role: TRole;
  email: string;
}
