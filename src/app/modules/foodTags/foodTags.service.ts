/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { FoodTags } from "./foodTags.model";
import { FoodLog } from "../foodLogs/foodLogs.model";
import AppError from "../../error/appError";
import config from "../../config";

const AI_BASE = config.ai_service_url as string;

// ─── Generate & Save Food Tags ────────────────────────────────────────────────
// Collects all usda_ids from user's food logs → calls /food/tags → saves result

const generateFoodTags = async (
  userId: string,
  query: { days?: number } = {},
) => {
  const days = query.days ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // ── Step 1: Collect all usda_ids from user's food logs ────────────────────
  const logs = await FoodLog.find({
    userId: new Types.ObjectId(userId),
    loggedAt: { $gte: since },
  }).select("foods");

  if (!logs.length) {
    throw new AppError(
      404,
      "No food logs found. Start logging meals to get your food trigger analysis.",
    );
  }

  // Extract all usda_ids, filter out 0 and duplicates
  const allUsdaIds = logs
    .flatMap((log: any) => log.foods.map((f: any) => f.usda_id))
    .filter((id: number) => id && id > 0);

  const uniqueUsdaIds = [...new Set(allUsdaIds)] as number[];

  if (!uniqueUsdaIds.length) {
    throw new AppError(
      422,
      "No valid USDA food IDs found in your logs. Try logging more meals.",
    );
  }

  // ── Step 2: Call Python /food/tags ────────────────────────────────────────
  const tagsRes = await fetch(`${AI_BASE}/food/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usda_ids: uniqueUsdaIds }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!tagsRes.ok) {
    const errText = await tagsRes.text().catch(() => "AI service error");
    throw new AppError(502, `Food tags analysis failed: ${errText}`);
  }

  const tagsData = await tagsRes.json();
  // Response: { foods_analysed, categorised_count, top_categories: [{ category, food_count, insight, severity }] }

  // ── Step 3: Save to DB (upsert — always keep latest) ─────────────────────
  const saved = await FoodTags.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    {
      userId: new Types.ObjectId(userId),
      foods_analysed: tagsData.foods_analysed,
      categorised_count: tagsData.categorised_count,
      top_categories: tagsData.top_categories,
      usda_ids_used: uniqueUsdaIds,
      generatedAt: new Date(),
    },
    { upsert: true, new: true, runValidators: true },
  );

  return saved;
};

// ─── Get Saved Food Tags ──────────────────────────────────────────────────────

const getMyFoodTags = async (userId: string) => {
  const tags = await FoodTags.findOne({
    userId: new Types.ObjectId(userId),
  }).sort({ generatedAt: -1 });

  if (!tags) {
    throw new AppError(
      404,
      "No food trigger analysis found. Call POST /food-tags/generate first.",
    );
  }

  return tags;
};

// ─── Clinician: Get Patient Food Tags ────────────────────────────────────────

const getPatientFoodTags = async (patientId: string) => {
  const tags = await FoodTags.findOne({
    userId: new Types.ObjectId(patientId),
  }).sort({ generatedAt: -1 });

  if (!tags) {
    throw new AppError(404, "No food trigger analysis found for this patient.");
  }

  return tags;
};

export const FoodTagsService = {
  generateFoodTags,
  getMyFoodTags,
  getPatientFoodTags,
};
