/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { DietPlan } from "./dietPlan.model";
import { Connection } from "../connection/connection.model";
import { User } from "../user/user.model";
import AppError from "../../error/appError";

// ─── Helper: verify connection ────────────────────────────────────────────────
const _verifyConnection = async (clinicianId: string, patientId: string) => {
  const conn = await Connection.findOne({
    clinicianId: new Types.ObjectId(clinicianId),
    patientId:   new Types.ObjectId(patientId),
    status: "active",
  });
  if (!conn) throw new AppError(403, "No active connection with this patient");
};

// ─── Create / Replace Diet Plan ───────────────────────────────────────────────

const createDietPlan = async (
  clinicianId: string,
  patientId:   string,
  payload: {
    foodsToAvoid:    string[];
    foodsToIncrease: string[];
    additionalNotes: string;
    mealSuggestions: { mealType: string; foodSuggestion: string }[];
  }
) => {
  await _verifyConnection(clinicianId, patientId);

  const patient = await User.findById(patientId);
  if (!patient) throw new AppError(404, "Patient not found");

  // Deactivate any existing plan
  await DietPlan.updateMany(
    { patientId: new Types.ObjectId(patientId), isActive: true },
    { isActive: false }
  );

  // Create new plan
  const plan = await DietPlan.create({
    patientId:   new Types.ObjectId(patientId),
    clinicianId: new Types.ObjectId(clinicianId),
    ...payload,
    isActive:   true,
    notifiedAt: new Date(),
  });

  // TODO: send push notification to patient here
  // await NotificationService.send(patientId, "Your clinician has created a new diet plan for you")

  return plan;
};

// ─── Update Diet Plan ─────────────────────────────────────────────────────────

const updateDietPlan = async (
  clinicianId: string,
  patientId:   string,
  payload: Partial<{
    foodsToAvoid:    string[];
    foodsToIncrease: string[];
    additionalNotes: string;
    mealSuggestions: { mealType: string; foodSuggestion: string }[];
  }>
) => {
  await _verifyConnection(clinicianId, patientId);

  const plan = await DietPlan.findOneAndUpdate(
    {
      patientId:   new Types.ObjectId(patientId),
      clinicianId: new Types.ObjectId(clinicianId),
      isActive: true,
    },
    { ...payload, notifiedAt: new Date() },
    { new: true, runValidators: true }
  );

  if (!plan) throw new AppError(404, "No active diet plan found. Create one first.");
  return plan;
};

// ─── Get Diet Plan (Clinician view) ──────────────────────────────────────────

const getDietPlan = async (clinicianId: string, patientId: string) => {
  await _verifyConnection(clinicianId, patientId);

  const plan = await DietPlan.find({
    patientId:   new Types.ObjectId(patientId),
    clinicianId: new Types.ObjectId(clinicianId),
    // isActive: true,
  }).populate("patientId", "name email patientProfile");

  if (!plan) throw new AppError(404, "No active diet plan found for this patient");
  return plan;
};

// ─── Get My Diet Plan (Patient view) ─────────────────────────────────────────

const getMyDietPlan = async (patientId: string) => {
  const plan = await DietPlan.find({
    patientId: new Types.ObjectId(patientId),
    // isActive:  true,
  }).populate("clinicianId", "name email clinicianProfile");

  if (!plan) throw new AppError(404, "No diet plan found. Ask your clinician to create one.");
  return plan;
};

export const DietPlanService = {
  createDietPlan,
  updateDietPlan,
  getDietPlan,
  getMyDietPlan,
};