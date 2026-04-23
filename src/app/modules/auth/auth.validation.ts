import { z } from "zod";

const roleEnum = z.enum(["patient", "clinician", "admin"]);

const foodSensitivitiesEnum = z.enum([
  "Dairy",
  "Gluten",
  "Spicy",
  "Fried",
  "Sugar",
  "Caffeine",
  "Processed food",
  "Others",
]);

const symptomsEnum = z.enum([
  "Bloating",
  "Gas",
  "Abdominal Pain",
  "Nausea",
  "Heartburn",
  "Diarrhea",
  "Constipation",
  "Fatigue",
]);

// ─── Sign-up ─────────────────────────────────────────────────────────────────
export const signUpSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").trim(),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
    role: roleEnum,
    agreedToTerms: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the Terms & Conditions" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ─── Sign-in ─────────────────────────────────────────────────────────────────
export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

// ─── Forgot password ─────────────────────────────────────────────────────────
export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

// ─── Verify OTP ──────────────────────────────────────────────────────────────
export const verifyOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().length(4, "OTP must be 4 digits"),
});

// ─── Reset password ───────────────────────────────────────────────────────────
export const resetPasswordSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ─── Social auth ─────────────────────────────────────────────────────────────
export const socialAuthSchema = z.object({
  idToken: z.string().min(1, "ID token is required"),
  role: roleEnum,
});

// ─── Patient – health info ────────────────────────────────────────────────────
export const patientHealthInfoSchema = z.object({
  gender: z.string().min(1, "Gender is required"),
  age: z.number().int().positive("Age must be a positive integer"),
  sleepAvg: z.number().positive("Sleep average must be positive"),
  weight: z.number().positive("Weight must be positive"),
  isEliminationStage: z.boolean(),
});

// ─── Patient – food sensitivities ────────────────────────────────────────────
export const patientFoodSensitivitiesSchema = z.object({
  foodSensitivities: z
    .array(foodSensitivitiesEnum)
    .min(1, "Select at least one option"),
});

// ─── Patient – symptoms ───────────────────────────────────────────────────────
export const patientSymptomsSchema = z.object({
  symptoms: z.array(symptomsEnum).min(1, "Select at least one symptom"),
});

// ─── Clinician profile ────────────────────────────────────────────────────────
export const clinicianProfileSchema = z.object({
  department: z.string().min(1, "Department is required"),
  phone: z
    .string()
    .min(7, "Phone number is too short")
    .max(20, "Phone number is too long"),
  location: z.string().min(1, "Location is required"),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string({ required_error: "Old password is required" }),
  newPassword: z
    .string({ required_error: "New password is required" })
    .min(6, "Minimum 6 characters"),
});