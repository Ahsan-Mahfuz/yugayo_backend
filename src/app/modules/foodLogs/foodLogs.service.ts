/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { FoodLog } from "./foodLogs.model";
import { GutHealthScore } from "../score/score.model";
import AppError from "../../error/appError";
import config from "../../config";
import {
  IManualFoodLogPayload,
  IVoiceFoodLogPayload,
  IBarcodePayload,
  IFoodLogEntry,
  TMealType,
} from "./foodLogs.interface";

const AI_BASE = config.ai_service_url as string;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const _getCurrentScore = async (userId: string): Promise<number> => {
  const scoreDoc = await GutHealthScore.findOne({
    userId: new Types.ObjectId(userId),
  });
  return scoreDoc?.score ?? 70;
};

const _callLogFood = async (
  currentScore: number,
  mealType: TMealType,
  foods: Array<{
    usda_id: number;
    quantity: number;
    unit: string;
    raw_food?: string;
  }>,
): Promise<any> => {
  // Python /log/food expects:
  //   foods    → plain text food name string (min 2 chars)  e.g. "chicken biryani"
  //   quantity → string with value + unit combined           e.g. "400g" or "1piece"
  //   meal_type, current_score

  // Use raw_food name if available, otherwise fall back to usda_id
  // IMPORTANT: never send "0" — Python rejects strings shorter than 2 chars
  const foodsString = foods
    .map((f) => {
      if (f.raw_food && f.raw_food.trim().length >= 2) return f.raw_food.trim();
      if (f.usda_id && f.usda_id > 0) return String(f.usda_id);
      return "food"; // safe fallback
    })
    .join(", ");

  const firstFood = foods[0];
  const quantityStr = `${firstFood?.quantity ?? 100}${firstFood?.unit ?? "g"}`;

  const res = await fetch(`${AI_BASE}/log/food`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_score: currentScore,
      meal_type: mealType,
      foods: foodsString,
      quantity: quantityStr,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    const detail = errJson?.detail ?? "AI service error";

    // Map known AI error messages to user-friendly equivalents
    if (
      typeof detail === "string" &&
      detail.toLowerCase().includes("no recognisable food")
    ) {
      throw new AppError(
        422,
        "We couldn't recognize this food item. Please try another product or enter it manually.",
      );
    }

    throw new AppError(502, detail);
  }
  return res.json();
};

const _updateStoredScore = async (
  userId: string,
  newScore: number,
  grade: string,
) => {
  await GutHealthScore.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    { score: newScore, grade },
    { new: true },
  );
};

const _gradeFromScore = (score: number): string => {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
};

// ─── 1. Manual Entry ──────────────────────────────────────────────────────────

const manualLog = async (userId: string, payload: IManualFoodLogPayload) => {
  const currentScore = await _getCurrentScore(userId);
  const foodEntries: IFoodLogEntry[] = [];

  for (const item of payload.foods) {
    const parseRes = await fetch(`${AI_BASE}/food/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: item.foodName, top_k: 1 }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!parseRes.ok)
      throw new AppError(502, `Food parse failed for "${item.foodName}"`);

    const parseData = await parseRes.json();
    const topResult = parseData.results?.[0];
    if (!topResult?.usda_id)
      throw new AppError(422, `Could not identify food: "${item.foodName}"`);

    foodEntries.push({
      usda_id: topResult.usda_id,
      quantity: item.quantity,
      unit: item.unit,
      food_description: topResult.normalised_name ?? item.foodName,
      raw_food: item.foodName,
    });
  }

  const aiResult = await _callLogFood(
    currentScore,
    payload.mealType,
    foodEntries.map((f) => ({
      usda_id: f.usda_id,
      quantity: f.quantity,
      unit: f.unit,
      raw_food: f.raw_food,
    })),
  );

  await _updateStoredScore(
    userId,
    aiResult.updated_score,
    _gradeFromScore(aiResult.updated_score),
  );

  return FoodLog.create({
    userId: new Types.ObjectId(userId),
    logMethod: "manual",
    mealType: payload.mealType,
    foods: foodEntries,
    previousScore: currentScore,
    scoreModifier: aiResult.score_modifier ?? 0,
    updatedScore: aiResult.updated_score,
    grade: _gradeFromScore(aiResult.updated_score),
    summary: aiResult?.note ?? "",
    foodDetails: aiResult.results ?? [],
    recommendations: aiResult.recommendations ?? [],
    loggedAt: new Date(),
  });
};

// ─── 2. Voice Entry ───────────────────────────────────────────────────────────
// POST /food/parse with current_score → returns results + updated_score + note directly

const voiceLog = async (userId: string, payload: IVoiceFoodLogPayload) => {
  const currentScore = await _getCurrentScore(userId);

  const parseRes = await fetch(`${AI_BASE}/food/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: payload.text,
      current_score: currentScore,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!parseRes.ok) {
    const errText = await parseRes.text().catch(() => "AI service error");
    throw new AppError(502, `Food parse failed: ${errText}`);
  }

  const parseData = await parseRes.json();

  if (!parseData.results?.length) {
    throw new AppError(
      422,
      "No foods detected in the voice input. Please try again.",
    );
  }

  const detectedMealType: TMealType =
    (parseData.meal_type as TMealType) ?? "Snack";

  const foodEntries: IFoodLogEntry[] = parseData.results.map((f: any) => ({
    usda_id: f.usda_id,
    quantity: f.weight_g ?? 100,
    unit: "g" as const,
    food_description: f.normalised_name,
    raw_food: f.normalised_name,
  }));

  const updatedScore = parseData.updated_score ?? currentScore;
  const scoreImpact = parseData.score_impact ?? 0;

  await _updateStoredScore(userId, updatedScore, _gradeFromScore(updatedScore));

  return FoodLog.create({
    userId: new Types.ObjectId(userId),
    logMethod: "voice",
    mealType: detectedMealType,
    foods: foodEntries,
    rawText: payload.text,
    previousScore: currentScore,
    scoreModifier: scoreImpact,
    updatedScore,
    grade: _gradeFromScore(updatedScore),
    summary: parseData.note ?? "",
    foodDetails: [],
    recommendations: [],
    loggedAt: new Date(),
  });
};

// ─── 3. Barcode Scan ──────────────────────────────────────────────────────────
// Flow: POST /scan/barcode → product_name
//       → POST /log/food with product_name directly (skip /food/parse if usda not needed)
//       → save to DB

const barcodeLog = async (userId: string, payload: IBarcodePayload) => {
  const currentScore = await _getCurrentScore(userId);

  // ── Step 1: Scan barcode → product name ───────────────────────────────────
  const barcodeRes = await fetch(`${AI_BASE}/scan/barcode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: payload.barcode }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!barcodeRes.ok) {
    const errData = await barcodeRes.json().catch(() => ({}));
    const detail = (errData as any).detail ?? "Product not found";
    throw new AppError(
      barcodeRes.status === 404 ? 404 : 502,
      `Barcode lookup failed: ${detail}`,
    );
  }

  const barcodeData = await barcodeRes.json();
  const productName = (barcodeData.product_name as string) ?? "Unknown product";
  const productQty = barcodeData.quantity as string | null;

  // ── Step 2: Try /food/parse to get usda_id (best effort) ─────────────────
  let usda_id = 0;
  let normalisedName = productName;

  console.log("==========================", barcodeData);

  try {
    const parseRes = await fetch(`${AI_BASE}/food/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: productName, top_k: 1 }),
      signal: AbortSignal.timeout(15_000),
    });
    if (parseRes.ok) {
      const parseData = await parseRes.json();
      const topResult = parseData.results?.[0];
      if (topResult?.usda_id) {
        usda_id = topResult.usda_id;
        normalisedName = topResult.normalised_name ?? productName;
      }
    }
  } catch {
    // Non-fatal — continue with productName directly
  }

  const quantity =
    payload.quantity ?? (productQty ? parseFloat(productQty) : 100);
  const unit = payload.unit ?? "g";

  const foodEntry: IFoodLogEntry = {
    usda_id,
    quantity,
    unit,
    food_description: normalisedName,
    raw_food: productName, // always the human-readable product name
    barcode: payload.barcode,
    product_name: productName,
  };

  // ── Step 3: Log food → score update ───────────────────────────────────────
  // Pass productName as raw_food so foods string is never "0"
  const aiResult = await _callLogFood(currentScore, payload.mealType, [
    { usda_id, quantity, unit, raw_food: productName },
  ]);

  await _updateStoredScore(
    userId,
    aiResult.updated_score,
    _gradeFromScore(aiResult.updated_score),
  );

  // ── Step 4: Save to DB ────────────────────────────────────────────────────
  return FoodLog.create({
    userId: new Types.ObjectId(userId),
    logMethod: "barcode",
    mealType: payload.mealType,
    foods: [foodEntry],
    barcodeValue: payload.barcode,
    previousScore: currentScore,
    scoreModifier: aiResult.score_modifier ?? 0,
    updatedScore: aiResult.updated_score,
    grade: _gradeFromScore(aiResult.updated_score),
    summary: aiResult.note ?? "",
    foodDetails: aiResult.results ?? [],
    recommendations: aiResult.recommendations ?? [],
    loggedAt: new Date(),
  });
};

// ─── Get Logs ─────────────────────────────────────────────────────────────────

const getMyLogs = async (
  userId: string,
  query: {
    date?: string;
    mealType?: string;
    page?: number;
    search?: string;
    limit?: number;
  },
) => {
  const filter: Record<string, any> = { userId: new Types.ObjectId(userId) };

  if (query.date) {
    const start = new Date(`${query.date}T00:00:00.000Z`);
    const end = new Date(`${query.date}T23:59:59.999Z`);
    filter.loggedAt = { $gte: start, $lte: end };
  }
  if (query.mealType) filter.mealType = query.mealType;

  if (query.search) {
    const searchRegex = new RegExp(query.search, "i");

    filter.$or = [
      { "foods.food_description": searchRegex },
      { "foods.raw_food": searchRegex },
      { rawText: searchRegex },
      { summary: searchRegex },
    ];
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    FoodLog.find(filter).sort({ loggedAt: -1 }).skip(skip).limit(limit),
    FoodLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const FoodLogService = {
  manualLog,
  voiceLog,
  barcodeLog,
  getMyLogs,
};
