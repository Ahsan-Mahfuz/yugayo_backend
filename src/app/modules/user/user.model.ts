import { Schema, model } from "mongoose";
import bcrypt from "bcryptjs";
import { IUser } from "./user.interface";

const patientProfileSchema = new Schema(
  {
    gender: { type: String },
    age: { type: Number },
    sleepAvg: { type: Number },
    weight: { type: Number },
    isEliminationStage: { type: Boolean, default: false },
    foodSensitivities: [{ type: String }],
    symptoms: [{ type: String }],
  },
  { _id: false },
);

const clinicianProfileSchema = new Schema(
  {
    department: { type: String },
    phone: { type: String },
    location: { type: String },
    isProfileComplete: { type: Boolean, default: false },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, select: false },
    role: {
      type: String,
      enum: ["patient", "clinician", "admin"],
      required: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google", "apple"],
      default: "local",
    },
    googleId: { type: String, sparse: true },
    appleId: { type: String, sparse: true },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    rememberMe: { type: Boolean, default: false },

    // ── Profile picture ────────────────────────────────────────────────────
    // Stored as a relative URL path: /uploads/profile/<filename>
    // Served statically via express: app.use("/uploads", express.static("uploads"))
    profilePicture: { type: String, default: null },

    patientProfile: patientProfileSchema,
    clinicianProfile: clinicianProfileSchema,

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    // OTP
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    // Password reset
    passwordResetToken: { type: String, select: false },
    passwordResetExpiry: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method – compare passwords
userSchema.methods.matchPassword = async function (
  plain: string,
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(plain, this.password);
};

export const User = model<IUser>("User", userSchema);
