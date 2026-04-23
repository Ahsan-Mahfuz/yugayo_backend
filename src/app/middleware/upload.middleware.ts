/* eslint-disable @typescript-eslint/no-explicit-any */
import multer from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";
import AppError from "../error/appError";

// ─── Ensure uploads/profile directory exists ──────────────────────────────────
const uploadDir = path.join(process.cwd(), "uploads", "profile");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `profile-${unique}${ext}`);
  },
});

// ─── File filter — images only ────────────────────────────────────────────────
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(400, "Only JPEG, PNG, and WebP images are allowed") as any);
  }
};

// ─── Export configured multer instance ───────────────────────────────────────
export const uploadProfilePicture = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
}).single("profilePicture"); // field name expected from FormData
