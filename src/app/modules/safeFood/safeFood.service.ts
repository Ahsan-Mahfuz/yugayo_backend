/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { SafeFood } from "./safeFood.model";
import { FoodLog } from "../foodLogs/foodLogs.model";
import { SymptomLog } from "../symptomLog/symptomLog.model";
import AppError from "../../error/appError";
import config from "../../config";

const AI_BASE = config.ai_service_url as string;

// ─── GET: Return cached safe foods ───────────────────────────────────────────

const getSafeFoods = async (userId: string) => {
  const doc = await SafeFood.findOne({ userId: new Types.ObjectId(userId) });
  if (!doc)
    throw new AppError(
      404,
      "No safe food recommendations found. Please generate them first.",
    );
  return doc;
};

// ─── POST: Generate from last 3 months + save ─────────────────────────────────

const generateSafeFoods = async (userId: string) => {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  threeMonthsAgo.setHours(0, 0, 0, 0);

  // ── 1. Fetch last 3 months of food logs ──────────────────────────────────
  const foodLogs = await FoodLog.find({
    userId: new Types.ObjectId(userId),
    loggedAt: { $gte: threeMonthsAgo },
  }).sort({ loggedAt: 1 });

  // ── 2. Fetch last 3 months of symptom logs ───────────────────────────────
  const symptomLogs = await SymptomLog.find({
    userId: new Types.ObjectId(userId),
    loggedAt: { $gte: threeMonthsAgo },
  }).sort({ loggedAt: 1 });

  // ── 3. Build food_logs payload ────────────────────────────────────────────
  const foodLogsPayload = foodLogs.flatMap((log) =>
    log.foods
      .filter((f) => f.usda_id && f.usda_id > 0)
      .map((f) => ({
        usda_id: f.usda_id,
        weight_g: f.quantity,
        logged_at: log.loggedAt.toISOString(),
      })),
  );

  // ── 4. Build symptom_logs payload ─────────────────────────────────────────
  const symptomLogsPayload = symptomLogs.flatMap((log) =>
    log.symptoms.map((symptom) => ({
      symptom,
      intensity: log.severity,
      logged_at: log.loggedAt.toISOString(),
    })),
  );

  if (foodLogsPayload.length === 0 && symptomLogsPayload.length === 0) {
    throw new AppError(
      422,
      "No food or symptom history found in the last 3 months to generate recommendations.",
    );
  }

  // ── 5. Call AI /recommend/safe_food ──────────────────────────────────────
  let aiResult: any;
  try {
    const res = await fetch(`${AI_BASE}/recommend/safe_food`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        food_logs: foodLogsPayload,
        symptom_logs: symptomLogsPayload,
        n: 5,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "AI service error");
      throw new Error(errText);
    }

    aiResult = await res.json();
  } catch (err: any) {
    throw new AppError(502, `Safe food AI failed: ${err.message}`);
  }

  // ── 6. Upsert — one record per user, always overwrite ────────────────────
  const doc = await SafeFood.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    {
      safe_foods: aiResult.safe_foods ?? [],
      foods_analysed: aiResult.foods_analysed ?? 0,
      composite_meals_detected: aiResult.composite_meals_detected ?? 0,
      symptoms_considered: aiResult.symptoms_considered ?? 0,
      source_note: aiResult.source_note ?? "",
      generatedAt: new Date(),
    },
    { new: true, upsert: true },
  );

  return doc;
};

export const SafeFoodService = {
  getSafeFoods,
  generateSafeFoods,
};
