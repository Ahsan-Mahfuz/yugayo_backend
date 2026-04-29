/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { FoodLog } from "../foodLogs/foodLogs.model";
import { SymptomLog } from "../symptomLog/symptomLog.model";

const getRiskCategory = (percentage: number): "High" | "Medium" | "Low" => {
  if (percentage >= 70) return "High";
  if (percentage >= 40) return "Medium";
  return "Low";
};

type TGenerateOptions = {
  days?: number;
  symptom?: string;
};

const generateFoodTags = async (
  userId: string,
  query: TGenerateOptions = {},
) => {
  const days = query.days ?? 30;
  const symptom = query.symptom?.trim();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Symptom logs with culprit foods in range
  const symptomLogs = await SymptomLog.find({
    userId: new Types.ObjectId(userId),
    loggedAt: { $gte: since },
  }).select("symptoms culpritFoods");

  const matchedLogs = symptom
    ? symptomLogs.filter((log) => (log.symptoms as string[]).includes(symptom))
    : symptomLogs;

  if (!matchedLogs.length) {
    return {
      symptom: symptom ?? null,
      days,
      high: [],
      medium: [],
      low: [],
      total_culprit_foods: 0,
      has_data: false,
      message: symptom
        ? `No symptom logs found for "${symptom}" in this period.`
        : "No symptom logs found in this period.",
    };
  }

  // total times eaten per food (denominator)
  const foodLogs = await FoodLog.find({
    userId: new Types.ObjectId(userId),
    loggedAt: { $gte: since },
  }).select("foods");

  const eatenCountMap: Record<number, number> = {};
  foodLogs.forEach((log: any) => {
    log.foods.forEach((food: any) => {
      if (!food.usda_id) return;
      eatenCountMap[food.usda_id] = (eatenCountMap[food.usda_id] ?? 0) + 1;
    });
  });

  // triggered times from culprit foods in symptom logs (numerator)
  const triggeredMap: Record<number, { food_name: string; times_triggered: number }> = {};
  matchedLogs.forEach((log: any) => {
    (log.culpritFoods as any[]).forEach((food) => {
      if (!food?.usda_id) return;
      if (!triggeredMap[food.usda_id]) {
        triggeredMap[food.usda_id] = {
          food_name: food.food_name ?? String(food.usda_id),
          times_triggered: 0,
        };
      }
      triggeredMap[food.usda_id].times_triggered += 1;
    });
  });

  const foods = Object.entries(triggeredMap)
    .map(([usdaId, data]) => {
      const usda_id = Number(usdaId);
      const total_times_eaten = eatenCountMap[usda_id] ?? 0;
      const percentage =
        total_times_eaten > 0
          ? Math.round((data.times_triggered / total_times_eaten) * 100)
          : 0;
      const risk_level = getRiskCategory(percentage);

      return {
        usda_id,
        food_name: data.food_name,
        times_triggered: data.times_triggered,
        total_times_eaten,
        percentage,
        risk_level,
      };
    })
    .sort((a, b) => b.percentage - a.percentage || b.times_triggered - a.times_triggered);

  if (!foods.length) {
    return {
      symptom: symptom ?? null,
      days,
      high: [],
      medium: [],
      low: [],
      total_culprit_foods: 0,
      has_data: false,
      message: symptom
        ? `No culprit foods found for "${symptom}" in this period.`
        : "No culprit foods found in this period.",
    };
  }

  const high = foods.filter((f) => f.risk_level === "High");
  const medium = foods.filter((f) => f.risk_level === "Medium");
  const low = foods.filter((f) => f.risk_level === "Low");

  return {
    symptom: symptom ?? null,
    days,
    high,
    medium,
    low,
    total_culprit_foods: foods.length,
    has_data: true,
    message: "Culprit foods categorized successfully.",
  };
};

const getMyFoodTags = async (userId: string, query: TGenerateOptions = {}) => {
  return generateFoodTags(userId, query);
};

// ─── Clinician: Get Patient Food Tags ────────────────────────────────────────

const getPatientFoodTags = async (patientId: string, query: TGenerateOptions = {}) => {
  return generateFoodTags(patientId, query);
};

export const FoodTagsService = {
  generateFoodTags,
  getMyFoodTags,
  getPatientFoodTags,
};
