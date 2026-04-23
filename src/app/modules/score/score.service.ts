/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Types } from "mongoose";
import { User } from "../user/user.model";
import { GutHealthScore } from "./score.model";
import AppError from "../../error/appError";
import config from "../../config";
import { getHealthStatus } from "../../utilities/healthStatus";
import { Connection } from "../connection/connection.model";
import { FoodLog } from "../foodLogs/foodLogs.model";
import { SymptomLog } from "../symptomLog/symptomLog.model";

// ─── AI URL ───────────────────────────────────────────────────────────────────
// Make sure your config has: ai_service_url = "https://fcpvmqwr-8000.inc1.devtunnels.ms"
// The /score path is appended here — do NOT include /score in the env variable
const AI_SCORE_URL = `${config.ai_service_url}/score`;

// ─── Core: Call Python AI & Save ─────────────────────────────────────────────

const _callAIAndSave = async (userId: string) => {
  // 1. Fetch user profile
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found");

  const p = user.patientProfile;

  if (!p?.gender || !p?.age || !p?.sleepAvg || !p?.weight) {
    throw new AppError(
      400,
      "Complete your health info before calculating score",
    );
  }
  if (!p?.foodSensitivities?.length) {
    throw new AppError(
      400,
      "Complete food sensitivities before calculating score",
    );
  }
  if (!p?.symptoms?.length) {
    throw new AppError(400, "Complete symptoms before calculating score");
  }

  // 2. Build payload
  const aiPayload = {
    gender: p.gender,
    age: p.age,
    sleep_hours: p.sleepAvg,
    weight_kg: p.weight,
    foods: p.foodSensitivities,
    symptoms: p.symptoms,
  };

  // 3. Call Python AI
  let aiResult: any;
  try {
    const res = await fetch(AI_SCORE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiPayload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "AI service error");
      throw new Error(errText);
    }

    aiResult = await res.json();
  } catch (err: any) {
    throw new AppError(502, `AI scoring service unavailable: ${err.message}`);
  }

  // 4. Upsert into MongoDB
  const scoreDoc = await GutHealthScore.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    {
      userId: new Types.ObjectId(userId),
      score: aiResult.score,
      grade: aiResult.grade,
      tagline: aiResult.tagline,
      breakdown: aiResult.breakdown,
      concerns: aiResult.concerns,
      recommendations: aiResult.recommendations,
      inputSnapshot: aiPayload,
    },
    { upsert: true, new: true, runValidators: true },
  );

  return scoreDoc;
};

// ─── Calculate & Save Onboarding Score (explicit POST) ───────────────────────

const calculateOnboardingScore = async (userId: string) => {
  return _callAIAndSave(userId);
};

// ─── Get My Score — auto-calculates if not yet saved ─────────────────────────

const getMyScore = async (userId: string) => {
  // Try to find existing score
  let score = await GutHealthScore.findOne({
    userId: new Types.ObjectId(userId),
  });

  // If no score yet → automatically calculate it now
  if (!score) {
    score = await _callAIAndSave(userId);
  }

  return score;
};

// ─── Admin: Get All Scores ────────────────────────────────────────────────────

const getAllScores = async (query: {
  page?: number;
  limit?: number;
  grade?: string;
  minScore?: number;
  maxScore?: number;
}) => {
  const filter: Record<string, any> = {};

  if (query.grade) filter.grade = query.grade;
  if (query.minScore !== undefined || query.maxScore !== undefined) {
    filter.score = {};
    if (query.minScore !== undefined) filter.score.$gte = query.minScore;
    if (query.maxScore !== undefined) filter.score.$lte = query.maxScore;
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const [scores, total] = await Promise.all([
    GutHealthScore.find(filter)
      .populate("userId", "name email role createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    GutHealthScore.countDocuments(filter),
  ]);

  return {
    scores,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Admin: Get Individual Score by userId ────────────────────────────────────

const getScoreByUserId = async (targetUserId: string) => {
  const score = await GutHealthScore.findOne({
    userId: new Types.ObjectId(targetUserId),
  }).populate("userId", "name email role createdAt");

  if (!score) throw new AppError(404, "No score found for this user.");
  return score;
};

const getPatientsWithStatus = async () => {
  // 1. Get all patients
  const users = await User.find({
    role: "patient",
  })
    .select("name email")
    .lean();

  // 2. Get scores
  const scores = await GutHealthScore.find({
    userId: { $in: users.map((u) => u._id) },
  }).lean();

  const scoreMap = new Map(scores.map((s) => [String(s.userId), s]));

  // 3. Get active connections + populate clinician
  const connections = await Connection.find({
    patientId: { $in: users.map((u) => u._id) },
    status: "active",
  })
    .populate("clinicianId", "name email")
    .lean();

  const connectionMap = new Map(
    connections.map((c) => [String(c.patientId), c]),
  );

  // 4. Merge everything
  const result = users.map((user) => {
    const scoreDoc = scoreMap.get(String(user._id));
    const connection = connectionMap.get(String(user._id));

    const score = scoreDoc?.score ?? 0;

    const clinician = connection?.clinicianId as any;

    return {
      ...user,
      healthScore: score,
      status: getHealthStatus(score),

      clinician: connection?.clinicianId
        ? {
            _id: clinician._id,
            name: clinician.name ?? "",
            email: clinician.email ?? "",
          }
        : null,
    };
  });

  return result;
};

const getPatientById = async (id: string) => {
  const user = await User.findById(id)
    .select("name email age patientProfile")
    .lean();

  if (!user) throw new AppError(404, "Patient not found");

  const score = await GutHealthScore.findOne({
    userId: user._id,
  }).lean();

  const connection = await Connection.findOne({
    patientId: user._id,
    status: "active",
  })
    .populate("clinicianId", "name email")
    .lean();

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    age: user.patientProfile?.age,

    status: getHealthStatus(score?.score ?? 0),
    healthScore: score?.score ?? 0,

    clinician: connection?.clinicianId || null,
  };
};

export const getPatientDetails = async (patientId: string) => {
  const user = await User.findById(patientId).select("name email age");

  if (!user) {
    throw new Error("Patient not found");
  }

  // score
  const scoreDoc = await GutHealthScore.findOne({
    userId: new mongoose.Types.ObjectId(patientId),
  }).lean();

  // connection
  const connection = await Connection.findOne({
    patientId: new mongoose.Types.ObjectId(patientId),
    status: "active",
  })
    .populate("clinicianId", "name email")
    .lean();

  // ─────────────────────────────────────
  // TODAY FILTER (for timeline)
  // ─────────────────────────────────────
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const foodLogsToday = await FoodLog.find({
    userId: patientId,
    createdAt: { $gte: start },
  })
    .sort({ createdAt: -1 })
    .lean();

  const symptomsToday = await SymptomLog.find({
    userId: patientId, // FIXED
    createdAt: { $gte: start },
  })
    .sort({ createdAt: -1 })
    .lean();

  // ─────────────────────────────────────
  // OVERALL COUNTS (for summary)
  // ─────────────────────────────────────
  const totalMeals = await FoodLog.countDocuments({
    userId: patientId,
  });

  const totalSymptoms = await SymptomLog.countDocuments({
    userId: patientId,
  });

  return {
    patient: {
      _id: user._id,
      name: user.name,
      email: user.email,
      // age: user.age,
    },

    healthScore: scoreDoc?.score ?? 0,
    status: scoreDoc?.grade ?? "Flare-up",

    clinician: connection?.clinicianId
      ? {
          _id: connection.clinicianId._id,
          // name: connection.clinicianId.name,
          // email: connection.clinicianId.email,
        }
      : null,

    // TODAY ONLY (timeline)
    foodLogs: foodLogsToday.map((f) => ({
      id: f._id,
      type: f.mealType,
      food: f.foods?.map((x) => x.raw_food ?? x.usda_id),
      time: f.createdAt,
    })),

    symptoms: symptomsToday.map((s) => ({
      id: s._id,
      name: s.symptoms,
      severity: s.severity,
      time: s.createdAt,
    })),

    // OVERALL SUMMARY (FIXED)
    summary: {
      totalMeals,
      totalSymptoms,
    },
  };
};

export const ScoreService = {
  calculateOnboardingScore,
  getMyScore,
  getAllScores,
  getScoreByUserId,
  getPatientsWithStatus,
  getPatientById,
  getPatientDetails,
};
