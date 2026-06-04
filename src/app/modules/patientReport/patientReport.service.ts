/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import moment from "moment-timezone";
import AppError from "../../error/appError";
import { Connection } from "../connection/connection.model";
import { User } from "../user/user.model";
import { FoodLog } from "../foodLogs/foodLogs.model";
import { SymptomLog } from "../symptomLog/symptomLog.model";
import { SafeFood } from "../safeFood/safeFood.model";
import { GutHealthScore } from "../score/score.model";
import {
  IReportAssociationRow,
  IReportData,
  IReportFlareRisk,
  IReportFoodLogRow,
  IReportProgressRow,
  IReportSafeFoodRow,
  IReportSymptomRow,
} from "./patientReport.interface";

// ─── Period helper ──────────────────────────────────────────────────────────
// Only 7 or 30 day periods are supported (per the report spec).
const _normaliseDays = (days: number): 7 | 30 => (days === 30 ? 30 : 7);

const _periodLabel = (days: number) => `Last ${days} Days`;

// ─── Date formatting ──────────────────────────────────────────────────────────
// Format a log's loggedAt in the timezone it was captured in (falls back to UTC).
const _fmtDateTime = (date: Date, tz?: string): string => {
  const m = tz && moment.tz.zone(tz) ? moment(date).tz(tz) : moment.utc(date);
  return m.format("MMM D, h:mm A");
};

// ─── Flare-risk mapping ─────────────────────────────────────────────────────
// food_score is the meal-level gut-impact value stored on each food log.
// We surface it as the "Estimated Gut Flare Risk" (higher value → higher risk).
// If the real semantics are inverted, flip the thresholds in this one helper.
const _flareRisk = (foodScore: number | null | undefined): IReportFlareRisk => {
  if (foodScore == null || !Number.isFinite(foodScore)) {
    return { label: "Unknown", score: null, display: "—" };
  }
  const score = Math.round(foodScore);
  let label = "Low";
  if (score >= 67) label = "High";
  else if (score >= 34) label = "Moderate";
  return { label, score, display: `${label} - ${score}/100` };
};

// ─── Gut balance label ──────────────────────────────────────────────────────
const _gutBalanceLabel = (score: number): string => {
  if (score >= 65) return "Good";
  if (score >= 40) return "Moderate";
  return "Low";
};

// ─── Combined food name from a food log ───────────────────────────────────────
const _foodNames = (foods: any[]): string =>
  (foods ?? [])
    .map((f) => f.raw_food || f.food_description || f.product_name || "Food")
    .filter(Boolean)
    .join(", ") || "—";

// ─── Most common symptom + frequency string ───────────────────────────────────
const _symptomCounts = (logs: any[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  logs.forEach((log) => {
    (log.symptoms ?? []).forEach((s: string) => {
      counts[s] = (counts[s] ?? 0) + 1;
    });
  });
  return counts;
};

const _topSymptom = (counts: Record<string, number>): string => {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries[0][0] : "—";
};

// ─── Build food–symptom associations from culprit foods ────────────────────────
// Reads the culpritFoods recorded on each symptom log (from the AI culprit
// analysis) and aggregates per (food, symptom) pair across the period.
const _buildAssociations = (symptomLogs: any[]): IReportAssociationRow[] => {
  // total times each symptom was logged in the period (denominator)
  const symptomTotals: Record<string, number> = {};
  symptomLogs.forEach((log) => {
    (log.symptoms ?? []).forEach((s: string) => {
      symptomTotals[s] = (symptomTotals[s] ?? 0) + 1;
    });
  });

  // (food|symptom) → { count, hours: number[] }
  const pairs: Record<string, { food: string; symptom: string; count: number; hours: number[] }> =
    {};

  symptomLogs.forEach((log) => {
    const culprits: any[] = (log.culpritFoods as any[]) ?? [];
    if (!culprits.length) return;
    (log.symptoms ?? []).forEach((symptom: string) => {
      culprits.forEach((cf) => {
        const food = cf.food_name || (cf.usda_id ? String(cf.usda_id) : null);
        if (!food) return;
        const key = `${food}__${symptom}`;
        if (!pairs[key]) pairs[key] = { food, symptom, count: 0, hours: [] };
        pairs[key].count += 1;
        if (typeof cf.hours_before === "number" && Number.isFinite(cf.hours_before)) {
          pairs[key].hours.push(cf.hours_before);
        }
      });
    });
  });

  return Object.values(pairs)
    .map((p) => {
      const total = symptomTotals[p.symptom] ?? p.count;
      const ratio = total > 0 ? p.count / total : 0;

      let level = "Early Signal";
      if (p.count >= 2 && ratio >= 0.6) level = "High";
      else if (p.count >= 2 && ratio >= 0.3) level = "Moderate";

      const avgHours = p.hours.length
        ? Math.round(p.hours.reduce((a, b) => a + b, 0) / p.hours.length)
        : null;
      const within = avgHours ? ` within about ${avgHours} hour${avgHours === 1 ? "" : "s"}` : "";

      const observedPattern =
        p.count === 1
          ? `Appeared before ${p.symptom.toLowerCase()} once${within}`
          : `Associated ${p.count} out of ${total} times${within}`;

      return {
        food: p.food,
        symptom: p.symptom,
        observedPattern,
        level,
        _count: p.count,
      };
    })
    .sort((a, b) => (b as any)._count - (a as any)._count)
    .map(({ food, symptom, observedPattern, level }) => ({
      food,
      symptom,
      observedPattern,
      level,
    }));
};

// ─── Build safe-foods rows ────────────────────────────────────────────────────
// Prefers the stored SafeFood analysis; counts how often each safe food was
// logged in the period. Falls back to "foods eaten ≥2× that were never a
// culprit" when no SafeFood record exists.
const _buildSafeFoods = (
  safeFoodDoc: any,
  foodLogs: any[],
  symptomLogs: any[],
): IReportSafeFoodRow[] => {
  // count occurrences of each food name across the period's food logs
  const logCounts: Record<string, number> = {};
  foodLogs.forEach((log) => {
    (log.foods ?? []).forEach((f: any) => {
      const name = (f.raw_food || f.food_description || f.product_name || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      logCounts[key] = (logCounts[key] ?? 0) + 1;
    });
  });

  const display = (key: string) => key.replace(/\b\w/g, (c) => c.toUpperCase());

  if (safeFoodDoc?.safe_foods?.length) {
    return (safeFoodDoc.safe_foods as string[])
      .map((name) => {
        const key = name.trim().toLowerCase();
        return {
          food: display(key),
          timesLogged: logCounts[key] ?? 0,
          symptomsAfter: "None observed",
        };
      })
      .slice(0, 15);
  }

  // Fallback: foods logged ≥2× that never appear as a culprit food
  const culpritNames = new Set<string>();
  symptomLogs.forEach((log) => {
    ((log.culpritFoods as any[]) ?? []).forEach((cf) => {
      if (cf.food_name) culpritNames.add(String(cf.food_name).toLowerCase());
    });
  });

  return Object.entries(logCounts)
    .filter(([key, count]) => count >= 2 && !culpritNames.has(key))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, count]) => ({
      food: display(key),
      timesLogged: count,
      symptomsAfter: "None observed",
    }));
};

// ─── Build progress (current vs previous period) ──────────────────────────────
const _buildProgress = (
  currentMeals: number,
  currentSymptomLogs: any[],
  previousMeals: number,
  previousSymptomLogs: any[],
  gutScore: number | null,
): { rows: IReportProgressRow[]; text: string; available: boolean } => {
  const curSymptomCount = currentSymptomLogs.length;
  const prevSymptomCount = previousSymptomLogs.length;

  const curTop = _topSymptom(_symptomCounts(currentSymptomLogs));
  const prevTop = _topSymptom(_symptomCounts(previousSymptomLogs));

  const available = previousMeals > 0 || prevSymptomCount > 0;

  const rows: IReportProgressRow[] = [
    {
      metric: "Meals Logged",
      current: String(currentMeals),
      previous: available ? String(previousMeals) : "N/A",
    },
    {
      metric: "Symptoms Logged",
      current: String(curSymptomCount),
      previous: available ? String(prevSymptomCount) : "N/A",
    },
    {
      metric: "Most Frequent Symptom",
      current: curTop,
      previous: available ? prevTop : "N/A",
    },
    {
      metric: "Gut Balance Score",
      current: gutScore != null ? `${gutScore}/100` : "N/A",
      previous: "N/A", // historical scores are not stored
    },
  ];

  let text: string;
  if (!available) {
    text =
      "Not enough data from the previous period to compare. Keep logging to unlock progress trends.";
  } else if (prevSymptomCount === 0) {
    text =
      curSymptomCount === 0
        ? "No symptoms were logged in either period."
        : `Symptoms increased from ${prevSymptomCount} to ${curSymptomCount} compared to the previous period.`;
  } else {
    const change = Math.round(
      ((curSymptomCount - prevSymptomCount) / prevSymptomCount) * 100,
    );
    if (change < 0) {
      text = `Symptoms decreased by ${Math.abs(change)}% compared to the previous period.`;
    } else if (change > 0) {
      text = `Symptoms increased by ${change}% compared to the previous period.`;
    } else {
      text = "Symptom frequency was unchanged compared to the previous period.";
    }
  }

  return { rows, text, available };
};

// ─── Verify clinician ↔ patient connection ────────────────────────────────────
const _verifyConnection = async (clinicianId: string, patientId: string) => {
  const conn = await Connection.findOne({
    clinicianId: new Types.ObjectId(clinicianId),
    patientId: new Types.ObjectId(patientId),
    status: "active",
  });
  if (!conn) throw new AppError(403, "No active connection with this patient");
};

// ─── Core: assemble the report data for a patient ──────────────────────────────
const buildReportData = async (
  patientId: string,
  daysInput: number,
): Promise<IReportData> => {
  const days = _normaliseDays(daysInput);
  const uid = new Types.ObjectId(patientId);

  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - days);
  const previousStart = new Date(now);
  previousStart.setDate(previousStart.getDate() - days * 2);

  const [
    patient,
    foodLogs,
    symptomLogs,
    prevFoodCount,
    prevSymptomLogs,
    safeFoodDoc,
    scoreDoc,
  ] = await Promise.all([
    User.findById(uid).select("name email"),
    FoodLog.find({ userId: uid, loggedAt: { $gte: currentStart, $lte: now } }).sort({
      loggedAt: 1,
    }),
    SymptomLog.find({
      userId: uid,
      loggedAt: { $gte: currentStart, $lte: now },
    }).sort({ loggedAt: 1 }),
    FoodLog.countDocuments({
      userId: uid,
      loggedAt: { $gte: previousStart, $lt: currentStart },
    }),
    SymptomLog.find({
      userId: uid,
      loggedAt: { $gte: previousStart, $lt: currentStart },
    }),
    SafeFood.findOne({ userId: uid }).sort({ generatedAt: -1 }),
    GutHealthScore.findOne({ userId: uid }),
  ]);

  if (!patient) throw new AppError(404, "Patient not found");

  // ── Food log rows ──
  const foodLogRows: IReportFoodLogRow[] = foodLogs.map((log: any) => ({
    dateTime: _fmtDateTime(log.loggedAt, log.clientTimezone),
    mealType: log.mealType,
    foods: _foodNames(log.foods),
    flareRisk: _flareRisk(log.food_score),
  }));

  // ── Symptom log rows (one row per symptom) ──
  const symptomRows: IReportSymptomRow[] = [];
  symptomLogs.forEach((log: any) => {
    (log.symptoms ?? []).forEach((symptom: string) => {
      symptomRows.push({
        dateTime: _fmtDateTime(log.loggedAt, log.clientTimezone),
        symptom,
        severity: log.severity,
      });
    });
  });

  // ── Symptom frequency string ──
  const counts = _symptomCounts(symptomLogs);
  const symptomFrequency =
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([s, c]) => `${s} ${c} time${c === 1 ? "" : "s"}`)
      .join(" | ") || "No symptoms logged";

  const mostCommonSymptom = _topSymptom(counts);

  // ── Associations & safe foods ──
  const associations = _buildAssociations(symptomLogs);
  const safeFoods = _buildSafeFoods(safeFoodDoc, foodLogs, symptomLogs);

  // ── Summary ──
  const gutScore = scoreDoc?.score ?? null;
  const gutBalance =
    gutScore != null
      ? `${gutScore}/100 - ${scoreDoc?.grade || _gutBalanceLabel(gutScore)}`
      : "N/A";

  const assocFoods = Array.from(new Set(associations.map((a) => a.food))).slice(0, 2);
  const summaryText =
    `The patient logged ${foodLogs.length} meal${foodLogs.length === 1 ? "" : "s"} and ` +
    `${symptomLogs.length} symptom${symptomLogs.length === 1 ? "" : "s"}. ` +
    (mostCommonSymptom !== "—"
      ? `${mostCommonSymptom} was the most common symptom. `
      : "") +
    (assocFoods.length
      ? `Possible food–symptom associations were found with ${assocFoods.join(" and ")}.`
      : "No clear food–symptom associations were found in this period.");

  // ── Progress ──
  const progress = _buildProgress(
    foodLogs.length,
    symptomLogs,
    prevFoodCount,
    prevSymptomLogs,
    gutScore,
  );

  return {
    generatedAt: now,
    patient: { name: patient.name || "Unknown Patient", email: patient.email },
    period: { label: _periodLabel(days), days },
    summary: {
      gutBalance,
      totalMeals: foodLogs.length,
      totalSymptoms: symptomLogs.length,
      mostCommonSymptom,
      text: summaryText,
    },
    foodLogs: foodLogRows,
    symptomLogs: symptomRows,
    symptomFrequency,
    associations,
    safeFoods,
    progress,
    disclaimer:
      "This report is for informational tracking only and is not a medical diagnosis.",
  };
};

// ─── Public API ────────────────────────────────────────────────────────────────

/** Clinician downloads a connected patient's report. */
const getReportForClinician = async (
  clinicianId: string,
  patientId: string,
  days: number,
): Promise<IReportData> => {
  await _verifyConnection(clinicianId, patientId);
  return buildReportData(patientId, days);
};

/** Patient downloads their own report. */
const getReportForPatient = async (
  patientId: string,
  days: number,
): Promise<IReportData> => {
  return buildReportData(patientId, days);
};

export const PatientReportService = {
  getReportForClinician,
  getReportForPatient,
};
