import express from "express";
import { auth } from "../../middleware/auth";
import { uploadProfilePicture } from "../../middleware/upload.middleware";
import { UserProfileController } from "./userProfile.controller";

const router = express.Router();

// All routes require a valid JWT (any role)
router.use(auth("patient", "clinician", "admin"));

/**
 * PATCH /api/v1/user/profile/picture
 *
 * Upload/replace profile picture only.
 * Content-Type: multipart/form-data
 * Body field: profilePicture (file — JPEG / PNG / WebP, max 5 MB)
 *
 * Response: updated user object with new profilePicture URL
 */
router.patch(
  "/profile/picture",
  uploadProfilePicture,
  UserProfileController.updateProfilePicture,
);

/**
 * PATCH /api/v1/user/profile
 *
 * Update profile information. Can also include a profile picture in the same request.
 * Content-Type: multipart/form-data  (or application/json if no picture)
 *
 * Shared fields (any role):
 *   name            string
 *   profilePicture  file (optional)
 *
 * Patient-only fields:
 *   gender              string
 *   age                 number
 *   sleepAvg            number
 *   weight              number
 *   isEliminationStage  boolean ("true" / "false" as string in FormData)
 *
 * Clinician-only fields:
 *   department  string
 *   phone       string
 *   location    string
 *
 * Response: updated user object
 */
router.patch(
  "/profile",
  uploadProfilePicture, // parses multipart; req.file = picture if sent
  UserProfileController.updateProfile,
);

export const UserProfileRoutes = router;
