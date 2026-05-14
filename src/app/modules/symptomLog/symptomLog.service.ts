/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { SymptomLog } from "./symptomLog.model";
import { GutHealthScore } from "../score/score.model";
import AppError from "../../error/appError";
import config from "../../config";
import { ISymptomLogPayload } from "./symptomLog.interface";
import { FoodLog, IFoodLogDocument } from "../foodLogs/foodLogs.model";
import { IFoodLogEntry } from "../foodLogs/foodLogs.interface";
import { foodNameForAiPayload } from "../foodLogs/foodEntryDisplayName";
import {
  persistFoodNoteForSymptomCulprit,
  requestFoodNoteForMealLog,
  type TFoodNoteClientPayload,
} from "../foodLogs/foodLogs.service";

const AI_BASE = config.ai_service_url as string;

const _resolveClientMeta = (
  payload: {
    clientTimezone?: string;
    clientUtcOffsetMinutes?: number;
    clientCountry?: string;
  },
  requestMeta?: {
    timezone?: string;
    utcOffsetMinutes?: number;
    country?: string;
  },
) => ({
  clientTimezone: payload.clientTimezone ?? requestMeta?.timezone,
  clientUtcOffsetMinutes:
    payload.clientUtcOffsetMinutes ?? requestMeta?.utcOffsetMinutes,
  clientCountry: payload.clientCountry ?? requestMeta?.country,
});

const _hoursBetweenFoodAndSymptom = (foodLoggedAt: Date, symptomAt: Date) =>
  (symptomAt.getTime() - foodLoggedAt.getTime()) / (3600 * 1000);

/** Match culprit `usda_id` + timing to the most plausible meal row in recent logs. */
const _resolveFoodLogIdForCulprit = (
  symptomAt: Date,
  culprit: { usda_id?: number | null; hours_before?: number | null },
  recentFoodLogs: IFoodLogDocument[],
): Types.ObjectId | null => {
  const uid = culprit.usda_id;
  if (uid == null || Number.isNaN(Number(uid))) return null;

  const withMatch = recentFoodLogs.filter((log) =>
    (log.foods as IFoodLogEntry[]).some((f) => f.usda_id === uid),
  );
  if (withMatch.length === 0) return null;

  const beforeSymptom = withMatch.filter((log) => log.loggedAt <= symptomAt);
  const pool = beforeSymptom.length > 0 ? beforeSymptom : withMatch;

  const targetHb =
    typeof culprit.hours_before === "number" &&
    !Number.isNaN(culprit.hours_before)
      ? culprit.hours_before
      : null;

  if (targetHb === null) {
    const ranked = [...pool].sort(
      (a, b) => b.loggedAt.getTime() - a.loggedAt.getTime(),
    );
    return ranked[0]!._id as Types.ObjectId;
  }

  let best: IFoodLogDocument | null = null;
  let bestDiff = Infinity;
  for (const log of pool) {
    const h = _hoursBetweenFoodAndSymptom(log.loggedAt, symptomAt);
    const diff = Math.abs(h - targetHb);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = log;
    }
  }
  return best ? (best._id as Types.ObjectId) : null;
};

/** e.g. "Oatmeal, Banana, and Greek yogurt is associated with gas." → "Oatmeal, Banana, and Greek yogurt" */
const _targetFoodSubjectFromCulpritMessage = (
  culpritMessage: string | undefined,
): string | null => {
  const m = culpritMessage?.trim();
  if (!m) return null;
  const r =
    m.match(/^(.+?)\s+is\s+associated\b/i) ?? m.match(/^(.+?)\s+is\s+/i);
  const s = r?.[1]?.trim();
  return s && s.length > 0 ? s : null;
};

/** Prefer culprit-message wording; mirror symptom severity into `severity` when AI leaves it blank. */
const _presentSymptomFoodNote = (
  food_notes: TFoodNoteClientPayload,
  culpritMessage: string | undefined,
  symptomSeverity: string,
): TFoodNoteClientPayload => {
  const subject = _targetFoodSubjectFromCulpritMessage(culpritMessage);
  if ("unavailable" in food_notes && food_notes.unavailable) {
    const next = { ...food_notes };
    if (subject) next.target_food = subject;
    return next;
  }
  const p = food_notes as Extract<TFoodNoteClientPayload, { cached: boolean }>;
  let out = { ...p };
  if (subject) out = { ...out, target_food: subject };
  if (!String(out.severity ?? "").trim() && symptomSeverity.trim())
    out = { ...out, severity: symptomSeverity.trim() };
  return out;
};

/**
 * When meal AI note is unavailable, use symptom_culprit `message` as `note`.
 * Otherwise keep meal `note` as-is — association text lives in `culpritMessage` on the document.
 */
const _mergeCulpritMessageIntoFoodNote = (
  payload: TFoodNoteClientPayload,
  culpritMessage: string | undefined,
): TFoodNoteClientPayload => {
  const extra = culpritMessage?.trim();
  if (!extra) return payload;

  if ("unavailable" in payload && payload.unavailable) {
    return {
      target_food: payload.target_food,
      case: "with_symptoms",
      severity: "",
      note: extra,
      cached: false,
    };
  }

  return payload;
};

/**
 * After symptom log: one FoodNote per resolved meal (deduped), same /recommend/food_note
 * text/severity as meal-triggered notes.
 */
const _persistSymptomCulpritFoodNotes = async (
  userId: string,
  symptomLogId: Types.ObjectId,
  symptoms: string[],
  symptomSeverity: string,
  symptomAt: Date,
  culpritFoods: any[],
  culpritMessage: string | undefined,
  recentFoodLogs: IFoodLogDocument[],
) => {
  if (!culpritFoods.length) return;
  const seenFoodLogId = new Set<string>();
  let persistedMealNote = false;
  try {
    for (const cf of culpritFoods) {
      const foodLogId = _resolveFoodLogIdForCulprit(symptomAt, cf, recentFoodLogs);
      if (!foodLogId) continue;
      const idKey = String(foodLogId);
      if (seenFoodLogId.has(idKey)) continue;
      seenFoodLogId.add(idKey);

      const log = recentFoodLogs.find((l) => String(l._id) === idKey);
      if (!log) continue;

      let food_notes = await requestFoodNoteForMealLog(userId, log);
      food_notes = _mergeCulpritMessageIntoFoodNote(food_notes, culpritMessage);
      food_notes = _presentSymptomFoodNote(
        food_notes,
        culpritMessage,
        symptomSeverity,
      );
      await persistFoodNoteForSymptomCulprit(userId, {
        symptomLogId,
        symptoms,
        symptomSeverity,
        culpritFoods,
        culpritMessage,
        foodLogId,
        food_notes,
      });
      persistedMealNote = true;
    }

    if (!persistedMealNote) {
      const label =
        _targetFoodSubjectFromCulpritMessage(culpritMessage) ??
        (culpritFoods
          .map((c: { food_name?: string }) => String(c.food_name ?? "").trim())
          .filter(Boolean)
          .join(" + ") || "Food association");
      let food_notes: TFoodNoteClientPayload = {
        target_food: label,
        unavailable: true,
      };
      food_notes = _mergeCulpritMessageIntoFoodNote(food_notes, culpritMessage);
      food_notes = _presentSymptomFoodNote(
        food_notes,
        culpritMessage,
        symptomSeverity,
      );
      await persistFoodNoteForSymptomCulprit(userId, {
        symptomLogId,
        symptoms,
        symptomSeverity,
        culpritFoods,
        culpritMessage,
        food_notes,
      });
    }
  } catch (e) {
    console.warn(
      "Failed to persist symptom culprit food notes (non-fatal):",
      e,
    );
  }
};

// ─── Log Symptoms ─────────────────────────────────────────────────────────────

const logSymptoms = async (
  userId: string,
  payload: ISymptomLogPayload,
  requestMeta?: {
    timezone?: string;
    utcOffsetMinutes?: number;
    country?: string;
  },
) => {
  // ── 1. Get current gut health score ────────────────────────────────────────
  const scoreDoc = await GutHealthScore.findOne({
    userId: new Types.ObjectId(userId),
  });
  const currentScore = scoreDoc?.score ?? 70;

  // ── 2. Call AI to score the symptom log ────────────────────────────────────
  const aiPayload: Record<string, any> = {
    current_score: currentScore,
    symptoms: payload.symptoms,
    severity: payload.severity,
    logged_at: payload.loggedAt ?? new Date().toISOString(),
  };
  if (payload.note) aiPayload.note = payload.note;

  let aiResult: any;
  try {
    const res = await fetch(`${AI_BASE}/log/symptom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiPayload),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "AI service error");
      throw new Error(errText);
    }
    aiResult = await res.json();
  } catch (err: any) {
    throw new AppError(502, `AI symptom log failed: ${err.message}`);
  }

  // ── 3. Update gut health score ─────────────────────────────────────────────
  await GutHealthScore.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    { score: aiResult.updated_score, grade: aiResult.grade },
    { new: true },
  );

  // ── 4. Fetch last 2 days of food logs ──────────────────────────────────────
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  twoDaysAgo.setHours(0, 0, 0, 0);

  const recentFoodLogs = await FoodLog.find({
    userId: new Types.ObjectId(userId),
    loggedAt: { $gte: twoDaysAgo },
  }).sort({ loggedAt: 1 });

  // ── 5. Build food_logs payload (AI expects food_name, not usda_id) ───────────
  const foodLogsForCulprit = recentFoodLogs.flatMap((log) =>
    (log.foods as IFoodLogEntry[]).map((f) => ({
      food_name: foodNameForAiPayload(f),
      weight_g: f.quantity,
      logged_at: log.loggedAt.toISOString(),
    })),
  );

  // ── 6. Build symptom_logs payload — one entry per symptom ──────────────────
  const symptomLoggedAt = payload.loggedAt ?? new Date().toISOString();
  const symptomLogsForCulprit = payload.symptoms.map((symptom) => ({
    symptom,
    intensity: payload.severity,
    logged_at: symptomLoggedAt,
  }));

  // ── 7. Call /recommend/symptom_culprit ─────────────────────────────────────
  let culpritFoods: any[] = [];
  let culpritMessage: string | undefined;

  if (foodLogsForCulprit.length > 0) {
    try {
      const culpritRes = await fetch(`${AI_BASE}/recommend/symptom_culprit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_logs: foodLogsForCulprit,
          symptom_logs: symptomLogsForCulprit,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (culpritRes.ok) {
        const culpritData = await culpritRes.json();
        culpritMessage = culpritData.message;
        culpritFoods = (culpritData.culprit_details ?? []).map((item: any) => ({
          usda_id: item.usda_id,
          food_name: item.food_name,
          weight_g: item.weight_g,
          hours_before: item.hours_before,
          risk_level: item.risk_level,
          combined_risk: item.combined_risk,
          risk_nutrients: item.risk_nutrients ?? [],
        }));
      } else {
        const errText = await culpritRes.text().catch(() => "");
        console.warn("Culprit API non-OK:", culpritRes.status, errText);
      }
    } catch (error) {
      // Non-fatal — log and continue
      console.warn("Culprit API call failed (non-fatal):", error);
    }
  }

  // ── 8. Save symptom log + food notes for culprits (same feed as GET /food-log/food-notes)
  const clientMeta = _resolveClientMeta(payload, requestMeta);
  const symptomAt = payload.loggedAt ? new Date(payload.loggedAt) : new Date();
  const doc = await SymptomLog.create({
    userId: new Types.ObjectId(userId),
    symptoms: payload.symptoms,
    severity: payload.severity,
    note: payload.note,
    loggedAt: symptomAt,
    previousScore: aiResult.previous_score,
    scorePenalty: aiResult.score_penalty,
    updatedScore: aiResult.updated_score,
    grade: aiResult.grade,
    summary: aiResult.summary,
    perSymptomDetails: aiResult.per_symptom_details ?? [],
    noteAnalysis: aiResult.note_analysis ?? null,
    culpritFoods,
    culpritMessage,
    ...clientMeta,
  });

  await _persistSymptomCulpritFoodNotes(
    userId,
    doc._id as Types.ObjectId,
    payload.symptoms,
    payload.severity,
    symptomAt,
    culpritFoods,
    culpritMessage,
    recentFoodLogs,
  );

  return doc;
};
// ─── Get Single Symptom Log ───────────────────────────────────────────────────

const getSymptomLogById = async (userId: string, logId: string) => {
  const log = await SymptomLog.findOne({
    _id: logId,
    userId: new Types.ObjectId(userId),
  });
  if (!log) throw new AppError(404, "Symptom log not found");
  return log;
};

// ─── Get My Symptom Logs ──────────────────────────────────────────────────────

const getMySymptomLogs = async (
  userId: string,
  query: {
    date?: string;
    page?: number;
    limit?: number;
    timezoneOffsetMinutes?: number | string;
  },
) => {
  const filter: Record<string, any> = { userId: new Types.ObjectId(userId) };

  if (query.date) {
    const offsetMinutes = Number(query.timezoneOffsetMinutes ?? 0);
    const [year, month, day] = query.date.split("-").map(Number);
    const startUtcMs =
      Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMinutes * 60 * 1000;
    const endUtcMs =
      Date.UTC(year, month - 1, day, 23, 59, 59, 999) -
      offsetMinutes * 60 * 1000;
    const start = new Date(startUtcMs);
    const end = new Date(endUtcMs);
    filter.loggedAt = { $gte: start, $lte: end };
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    SymptomLog.find(filter).sort({ loggedAt: -1 }).skip(skip).limit(limit),
    SymptomLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Weekly Symptom Trend ─────────────────────────────────────────────────────

const getWeeklyTrend = async (userId: string) => {
  const today = new Date();

  // ─── Get Monday of current week ───
  const dayOfWeek = today.getDay();
  const diffToMonday = (dayOfWeek + 6) % 7;

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // ─── Base score (fallback) ───
  const scoreDoc = await GutHealthScore.findOne({
    userId: new Types.ObjectId(userId),
  });

  let lastKnownScore = scoreDoc?.score ?? 70;

  // ─── Fetch logs ───
  const logs = await SymptomLog.find({
    userId: new Types.ObjectId(userId),
    loggedAt: { $gte: weekStart, $lte: weekEnd },
  }).sort({ loggedAt: 1 });

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const days: any[] = [];

  // ─── LOOP WEEK DAYS ───
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);

    const dateStr = d.toISOString().split("T")[0];
    const dayName = DAY_NAMES[d.getDay()];

    const dayLogs = logs.filter(
      (l) => l.loggedAt.toISOString().split("T")[0] === dateStr,
    );

    // ─── symptom grouping ───
    const symptomMap: Record<string, { count: number; severities: string[] }> =
      {};

    let dayScore = lastKnownScore; // IMPORTANT: local copy per day

    dayLogs.forEach((log) => {
      log.symptoms.forEach((s) => {
        if (!symptomMap[s]) symptomMap[s] = { count: 0, severities: [] };
        symptomMap[s].count++;
        symptomMap[s].severities.push(log.severity);
      });

      // ─── update score if exists ───
      if (log.updatedScore !== undefined && log.updatedScore !== null) {
        dayScore = log.updatedScore;
      }
    });

    // ─── carry forward AFTER computing day ───
    lastKnownScore = dayScore;

    const symptomList = Object.entries(symptomMap).map(([name, data]) => ({
      name,
      count: data.count,
      severity: data.severities.includes("Severe")
        ? "Severe"
        : data.severities.includes("Moderate")
          ? "Moderate"
          : "Mild",
    }));

    const totalSymptoms = symptomList.reduce((a, b) => a + b.count, 0);

    days.push({
      date: dateStr,
      day: dayName,
      totalSymptoms,
      score: dayScore, // ✅ FIXED: stable value
      symptoms: symptomList,
    });
  }

  // ─── Weekly symptom summary ───
  const weekSymptomMap: Record<string, number> = {};

  logs.forEach((log) => {
    log.symptoms.forEach((s) => {
      weekSymptomMap[s] = (weekSymptomMap[s] ?? 0) + 1;
    });
  });

  const weeklySymptomSummary = Object.entries(weekSymptomMap)
    .sort((a, b) => b[1] - a[1])
    .map(([symptom, count]) => ({ symptom, count }));

  const worstDay = days.reduce(
    (max, d) => (d.totalSymptoms > max.totalSymptoms ? d : max),
    days[0],
  );

  return {
    period: {
      from: weekStart.toISOString().split("T")[0],
      to: weekEnd.toISOString().split("T")[0],
    },
    days,
    scoreTrend: days.map((d) => ({
      day: d.day,
      date: d.date,
      score: d.score,
    })),
    weeklySymptomSummary,
    worstDay: {
      day: worstDay.day,
      date: worstDay.date,
      totalSymptoms: worstDay.totalSymptoms,
    },
    totalLogsThisWeek: logs.length,
    totalSymptomsThisWeek: Object.values(weekSymptomMap).reduce(
      (a, b) => a + b,
      0,
    ),
  };
};

export const SymptomLogService = {
  logSymptoms,
  getSymptomLogById,
  getMySymptomLogs,
  getWeeklyTrend,
};
