/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { FoodLog } from "../foodLogs/foodLogs.model";
import { SymptomLog } from "../symptomLog/symptomLog.model";
import { GentleNote } from "./gentleNote.model";
import AppError from "../../error/appError";
import config from "../../config";
import { IGentleNoteAIResponse } from "./gentleNote.interface";

const AI_BASE = config.ai_service_url as string;
const PERIOD_DAYS = 15;

// ─── Unit → grams conversion ─────────────────────────────────────────────────

const _toGrams = (qty: number, unit: string): number => {
  const CONVERSIONS: Record<string, number> = {
    g: 1,
    gram: 1,
    grams: 1,
    kg: 1000,
    oz: 28.3495,
    lb: 453.592,
    ml: 1,
    l: 1000,
    cup: 240,
    tbsp: 15,
    tsp: 5,
    serving: 100,
    piece: 100,
    pieces: 100,
  };
  return Math.round(qty * (CONVERSIONS[unit.toLowerCase().trim()] ?? 1));
};

// ─── Generate & Save Gentle Note ─────────────────────────────────────────────

const generateGentleNote = async (userId: string) => {
  const since = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const uid = new Types.ObjectId(userId);

  // ── 1. Pull last 15 days of logs from DB ─────────────────────────────────
  const [foodLogs, symptomLogs] = await Promise.all([
    FoodLog.find({ userId: uid, loggedAt: { $gte: since } })
      .sort({ loggedAt: -1 })
      .lean(),
    SymptomLog.find({ userId: uid, loggedAt: { $gte: since } })
      .sort({ loggedAt: -1 })
      .lean(),
  ]);

  // ── 2. Build AI food_logs payload ─────────────────────────────────────────
  const aiFood: { usda_id: number; weight_g: number; logged_at: string }[] = [];

  for (const log of foodLogs) {
    for (const food of log.foods as any[]) {
      if (!food.usda_id || food.usda_id === 0) continue; // skip unresolved
      aiFood.push({
        usda_id: food.usda_id,
        weight_g: _toGrams(food.quantity ?? 100, food.unit ?? "g"),
        logged_at: (log.loggedAt as Date).toISOString(),
      });
    }
  }

  // ── 3. Build AI symptom_logs payload ──────────────────────────────────────
  const aiSymptoms: {
    symptom: string;
    intensity: string;
    logged_at: string;
  }[] = [];

  for (const log of symptomLogs) {
    for (const symptom of log.symptoms as string[]) {
      aiSymptoms.push({
        symptom,
        intensity: log.severity,
        logged_at: (log.loggedAt as Date).toISOString(),
      });
    }
  }

  // ── 4. Guard: AI requires at least 1 food log ─────────────────────────────
  if (aiFood.length === 0) {
    throw new AppError(
      400,
      "No food logs found for the last 15 days. Please log at least one meal before generating a gentle note.",
    );
  }

  // ── 5. Call AI /recommend/gentle_note ────────────────────────────────────
  let aiResult: IGentleNoteAIResponse;
  try {
    const res = await fetch(`${AI_BASE}/recommend/gentle_note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        food_logs: aiFood,
        symptom_logs: aiSymptoms,
        n: 5,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "AI service error");
      throw new Error(errText);
    }

    aiResult = await res.json();
  } catch (err: any) {
    throw new AppError(
      502,
      `Gentle note AI service unavailable: ${err.message}`,
    );
  }

  // ── 6. Save result to MongoDB ─────────────────────────────────────────────
  const saved = await GentleNote.create({
    userId: uid,
    note: aiResult.note,
    symptoms_found: aiResult.symptoms_found,
    trigger_foods: aiResult.trigger_foods,
    cached: aiResult.cached,
    periodDays: PERIOD_DAYS,
    generatedAt: new Date(),
  });

  return saved;
};

// ─── Get Latest Saved Note ────────────────────────────────────────────────────

const getLatestGentleNote = async (userId: string) => {
  const note = await GentleNote.findOne({
    userId: new Types.ObjectId(userId),
  }).sort({ generatedAt: -1 });

  if (!note) {
    throw new AppError(404, "No gentle note found. Please generate one first.");
  }
  return note;
};

// ─── Get History ──────────────────────────────────────────────────────────────

const getGentleNoteHistory = async (
  userId: string,
  query: { page?: number; limit?: number },
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const [notes, total] = await Promise.all([
    GentleNote.find({ userId: new Types.ObjectId(userId) })
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(limit),
    GentleNote.countDocuments({ userId: new Types.ObjectId(userId) }),
  ]);

  return {
    notes,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const GentleNoteService = {
  generateGentleNote,
  getLatestGentleNote,
  getGentleNoteHistory,
};
