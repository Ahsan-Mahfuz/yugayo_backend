/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { TriggerAnalysis } from "./triggerAnalysis.model";
import { FoodLog } from "../foodLogs/foodLogs.model";
import { SymptomLog } from "../symptomLog/symptomLog.model";
import { Connection } from "../connection/connection.model";
import AppError from "../../error/appError";
import config from "../../config";

const AI_BASE = config.ai_service_url as string;

// ─── Generate Trigger Analysis ────────────────────────────────────────────────
// Flow:
//  1. Collect last 90 days food logs + symptom logs from DB
//  2. POST /recommend/risky_food → predictions { symptom: [foods] }
//  3. For each symptom → POST /recommend/triggers_food → insight
//  4. Upsert full result to DB
//  5. Return

const generateTriggerAnalysis = async (
  userId: string,
  query: { days?: number } = {},
) => {
  const days = query.days ?? 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const uid = new Types.ObjectId(userId);

  // ── Step 1: Collect food logs + symptom logs ──────────────────────────────
  const [foodLogs, symptomLogs] = await Promise.all([
    FoodLog.find({ userId: uid, loggedAt: { $gte: since } })
      .select("foods loggedAt")
      .sort({ loggedAt: 1 }),
    SymptomLog.find({ userId: uid, loggedAt: { $gte: since } })
      .select("symptoms severity loggedAt")
      .sort({ loggedAt: 1 }),
  ]);

  if (!foodLogs.length) {
    throw new AppError(
      404,
      "No food logs found in the last 3 months. Start logging meals first.",
    );
  }
  if (!symptomLogs.length) {
    throw new AppError(
      404,
      "No symptom logs found in the last 3 months. Log some symptoms first.",
    );
  }

  // ── Build food_logs payload for Python API ────────────────────────────────
  // Each food item in a log entry becomes a separate entry
  // Foods in the same log share the same logged_at → grouped as composite meal
  const foodLogsPayload: Array<{
    usda_id: number;
    weight_g: number;
    logged_at: string;
  }> = [];

  foodLogs.forEach((log: any) => {
    log.foods.forEach((food: any) => {
      if (food.usda_id && food.usda_id > 0) {
        foodLogsPayload.push({
          usda_id: food.usda_id,
          weight_g: food.quantity ?? 100,
          logged_at: new Date(log.loggedAt).toISOString(),
        });
      }
    });
  });

  // ── Build symptom_logs payload ────────────────────────────────────────────
  // Each symptom in a log entry becomes a separate entry
  const symptomLogsPayload: Array<{
    symptom: string;
    intensity: string;
    logged_at: string;
  }> = [];

  symptomLogs.forEach((log: any) => {
    log.symptoms.forEach((symptom: string) => {
      symptomLogsPayload.push({
        symptom: symptom.toLowerCase(),
        intensity: (log.severity ?? "mild").toLowerCase(),
        logged_at: new Date(log.loggedAt).toISOString(),
      });
    });
  });

  if (!foodLogsPayload.length) {
    throw new AppError(
      422,
      "No valid USDA food IDs found. Try logging more meals with barcode or manual entry.",
    );
  }

  // ── Step 2: POST /recommend/risky_food ───────────────────────────────────
  const riskyRes = await fetch(`${AI_BASE}/recommend/risky_food`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      food_logs: foodLogsPayload,
      symptom_logs: symptomLogsPayload,
      user_id: userId,
    }),
    signal: AbortSignal.timeout(60_000), // 60s — this is a heavy AI call
  });

  if (!riskyRes.ok) {
    const errText = await riskyRes.text().catch(() => "AI service error");
    throw new AppError(502, `Risky food analysis failed: ${errText}`);
  }

  const riskyData = await riskyRes.json();
  // Response: { predictions: { bloating: ["Bananas", ...], headache: [...] },
  //             food_logs_processed, symptom_logs_processed,
  //             composite_meals_detected, evaluated_at }

  const predictions: Record<string, string[]> = riskyData.predictions ?? {};

  // ── Step 3: POST /recommend/triggers_food for each symptom ───────────────
  // Run all in parallel for speed
  const symptomEntries = Object.entries(predictions).filter(
    ([, foods]) => foods.length > 0,
  );

  const insightResults = await Promise.allSettled(
    symptomEntries.map(async ([symptom, foods]) => {
      const triggerRes = await fetch(`${AI_BASE}/recommend/triggers_food`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptom_name: symptom.charAt(0).toUpperCase() + symptom.slice(1), // "Bloating"
          food_name: foods,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!triggerRes.ok) {
        // Non-fatal — return partial result without insight
        return {
          symptom_name: symptom,
          trigger_foods: foods,
          insight: "",
        };
      }

      const triggerData = await triggerRes.json();
      return {
        symptom_name: triggerData.symptom_name ?? symptom,
        trigger_foods: triggerData.trigger_foods ?? foods,
        insight: triggerData.insight ?? "",
      };
    }),
  );

  // Collect results — use partial data even if some failed
  const insights = insightResults.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return {
      symptom_name: symptomEntries[i][0],
      trigger_foods: symptomEntries[i][1],
      insight: "",
    };
  });

  // ── Step 4: Upsert to DB ──────────────────────────────────────────────────
  const saved = await TriggerAnalysis.findOneAndUpdate(
    { userId: uid },
    {
      userId: uid,
      predictions,
      insights,
      food_logs_processed:
        riskyData.food_logs_processed ?? foodLogsPayload.length,
      symptom_logs_processed:
        riskyData.symptom_logs_processed ?? symptomLogsPayload.length,
      composite_meals_detected: riskyData.composite_meals_detected ?? 0,
      evaluated_at: riskyData.evaluated_at ?? new Date().toISOString(),
      periodDays: days,
      generatedAt: new Date(),
    },
    { upsert: true, new: true, runValidators: true },
  );

  return saved;
};

// ─── Get My Trigger Analysis ──────────────────────────────────────────────────

const getMyTriggerAnalysis = async (userId: string) => {
  const analysis = await TriggerAnalysis.findOne({
    userId: new Types.ObjectId(userId),
  }).sort({ generatedAt: -1 });

  if (!analysis) {
    throw new AppError(
      404,
      "No trigger analysis found. Call POST /triggers/generate first.",
    );
  }

  return analysis;
};

// ─── Clinician: Get Patient Trigger Analysis ──────────────────────────────────

const getPatientTriggerAnalysis = async (
  clinicianId: string,
  patientId: string,
) => {
  // Verify active connection
  const conn = await Connection.findOne({
    clinicianId: new Types.ObjectId(clinicianId),
    patientId: new Types.ObjectId(patientId),
    status: "active",
  });
  if (!conn) throw new AppError(403, "No active connection with this patient");

  const analysis = await TriggerAnalysis.findOne({
    userId: new Types.ObjectId(patientId),
  }).sort({ generatedAt: -1 });

  if (!analysis) {
    throw new AppError(404, "No trigger analysis found for this patient.");
  }

  return analysis;
};

export const TriggerAnalysisService = {
  generateTriggerAnalysis,
  getMyTriggerAnalysis,
  getPatientTriggerAnalysis,
};
