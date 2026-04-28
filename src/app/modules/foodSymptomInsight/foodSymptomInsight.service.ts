/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { SymptomLog } from "../symptomLog/symptomLog.model";

const ALL_SYMPTOMS = [
  "Bloating",
  "Abdominal Pain",
  "Nausea",
  "Constipation",
  "Heartburn",
  "Gas",
  "Fatigue",
  "Acid Reflux",
  "Cramps",
  "Diarrhea",
] as const;

const _buildReport = async (userId: string, sinceDate: Date) => {
  // All symptom logs in the period (with or without culprits — needed for total count)
  const allSymptomLogs = await SymptomLog.find({
    userId: new Types.ObjectId(userId),
    loggedAt: { $gte: sinceDate },
  });

  // Only logs that have culprit foods
  const culpritLogs = allSymptomLogs.filter(
    (log) => (log.culpritFoods as unknown as any[])?.length > 0,
  );

  // symptom → total times logged (denominator)
  const totalCountMap: Record<string, number> = {};
  ALL_SYMPTOMS.forEach((s) => (totalCountMap[s] = 0));
  allSymptomLogs.forEach((log) => {
    log.symptoms.forEach((s) => {
      totalCountMap[s] = (totalCountMap[s] ?? 0) + 1;
    });
  });

  // symptom → usda_id → { food_name, count }
  const map: Record<
    string,
    Record<number, { food_name: string; count: number }>
  > = {};
  ALL_SYMPTOMS.forEach((s) => (map[s] = {}));

  // Count how many times each symptom was triggered WITH a culprit food
  const triggeredCountMap: Record<string, number> = {};
  ALL_SYMPTOMS.forEach((s) => (triggeredCountMap[s] = 0));

  culpritLogs.forEach((log) => {
    log.symptoms.forEach((symptom) => {
      if (!map[symptom]) map[symptom] = {};

      // Count this event as "triggered" once per log (not per food)
      triggeredCountMap[symptom] = (triggeredCountMap[symptom] ?? 0) + 1;

      (log.culpritFoods as unknown as any[]).forEach((cf) => {
        if (!cf.usda_id) return;
        if (!map[symptom][cf.usda_id]) {
          map[symptom][cf.usda_id] = {
            food_name: cf.food_name ?? String(cf.usda_id),
            count: 0,
          };
        }
        map[symptom][cf.usda_id].count++;
      });
    });
  });

  return ALL_SYMPTOMS.map((symptom) => {
    const culprit_foods = Object.entries(map[symptom])
      .map(([usda_id, data]) => ({
        usda_id: Number(usda_id),
        food_name: data.food_name,
        times_triggered: data.count,
      }))
      .sort((a, b) => b.times_triggered - a.times_triggered);

    const totalLogged = totalCountMap[symptom] ?? 0;
    const timesTriggered = triggeredCountMap[symptom] ?? 0;
    const percentage =
      totalLogged > 0 ? Math.round((timesTriggered / totalLogged) * 100) : 0;

    // Combined food name string  e.g. "Egg, whole, cooked, fried, Bananas, raw"
    const combinedFoodName = culprit_foods.map((f) => f.food_name).join(", ");

    const message =
      culprit_foods.length > 0
        ? `${combinedFoodName} triggered ${symptom} ${timesTriggered} out of ${totalLogged} time${totalLogged !== 1 ? "s" : ""} (${percentage}%)`
        : `No culprit foods identified for ${symptom} in this period`;

    return {
      symptom,
      food_name: combinedFoodName || null,
      message,
      total_logged: totalLogged,
      times_triggered: timesTriggered,
      percentage,
      culprit_foods,
    };
  });
};

// ─── Patient ──────────────────────────────────────────────────────────────────

const getSymptomFoodReport = async (userId: string, days: number) => {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  return _buildReport(userId, since);
};

// ─── Clinician ────────────────────────────────────────────────────────────────

const getPatientSymptomFoodReport = async (patientId: string, days: number) => {
  return getSymptomFoodReport(patientId, days);
};

export const SymptomFoodReportService = {
  getSymptomFoodReport,
  getPatientSymptomFoodReport,
};
