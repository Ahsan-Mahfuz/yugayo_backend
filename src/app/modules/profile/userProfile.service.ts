/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";
import { User } from "../user/user.model";
import AppError from "../../error/appError";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface IUpdateProfilePayload {
  // Shared
  name?: string;

  // Patient-specific (nested under patientProfile)
  gender?: string;
  age?: number;
  sleepAvg?: number;
  weight?: number;
  isEliminationStage?: boolean;

  // Clinician-specific (nested under clinicianProfile)
  department?: string;
  phone?: string;
  location?: string;
}

// ─── Helper: delete old picture file ─────────────────────────────────────────
const _deleteOldPicture = (picturePath: string | undefined) => {
  if (!picturePath) return;

  // Strip leading slash / url prefix — keep only the local path
  const relative = picturePath.replace(/^\/+/, "");
  const absolute = path.join(process.cwd(), relative);

  if (fs.existsSync(absolute)) {
    fs.unlink(absolute, () => {
      // Non-blocking, ignore errors
    });
  }
};

// ─── Update profile picture only ──────────────────────────────────────────────
const updateProfilePicture = async (
  userId: string,
  file: Express.Multer.File,
) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found");

  // Delete old picture from disk
  _deleteOldPicture((user as any).profilePicture);

  // Build a URL-friendly path: /uploads/profile/<filename>
  const picturePath = `/uploads/profile/${file.filename}`;

  const updated = await User.findByIdAndUpdate(
    userId,
    { profilePicture: picturePath },
    { new: true, runValidators: true },
  ).select(
    "-password -otp -otpExpiry -passwordResetToken -passwordResetExpiry",
  );

  return updated;
};

// ─── Update profile info ──────────────────────────────────────────────────────
const updateProfile = async (
  userId: string,
  payload: IUpdateProfilePayload,
  file?: Express.Multer.File,
) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found");

  // ── Build the $set object ──────────────────────────────────────────────────
  const updates: Record<string, any> = {};

  // Shared fields
  if (payload.name !== undefined) updates.name = payload.name;

  // Profile picture (if file was uploaded alongside form data)
  if (file) {
    _deleteOldPicture((user as any).profilePicture);
    updates.profilePicture = `/uploads/profile/${file.filename}`;
  }

  // Patient-specific sub-doc fields (use dot notation to avoid overwriting other fields)
  if (user.role === "patient") {
    const patientFields: (keyof IUpdateProfilePayload)[] = [
      "gender",
      "age",
      "sleepAvg",
      "weight",
      "isEliminationStage",
    ];
    patientFields.forEach((field) => {
      if (payload[field] !== undefined) {
        updates[`patientProfile.${field}`] = payload[field];
      }
    });
  }

  // Clinician-specific sub-doc fields
  if (user.role === "clinician") {
    const clinicianFields: (keyof IUpdateProfilePayload)[] = [
      "department",
      "phone",
      "location",
    ];
    clinicianFields.forEach((field) => {
      if (payload[field] !== undefined) {
        updates[`clinicianProfile.${field}`] = payload[field];
      }
    });
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, "No valid fields provided to update");
  }

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true },
  ).select(
    "-password -otp -otpExpiry -passwordResetToken -passwordResetExpiry",
  );

  return updated;
};

export const UserProfileService = {
  updateProfilePicture,
  updateProfile,
};
