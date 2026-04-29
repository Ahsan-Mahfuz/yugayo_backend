/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { SymptomLog } from "./symptomLog.model";
import { GutHealthScore } from "../score/score.model";
import AppError from "../../error/appError";
import config from "../../config";
import { ISymptomLogPayload } from "./symptomLog.interface";
import { FoodLog } from "../foodLogs/foodLogs.model";

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

  // ── 5. Build food_logs payload (flatten all foods from each log) ────────────
  const foodLogsForCulprit = recentFoodLogs.flatMap((log) =>
    log.foods
      .filter((f) => f.usda_id && f.usda_id > 0)
      .map((f) => ({
        usda_id: f.usda_id,
        weight_g: f.quantity, // quantity stored in grams
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

  // ── 8. Save symptom log with culprit data ──────────────────────────────────
  const clientMeta = _resolveClientMeta(payload, requestMeta);
  return SymptomLog.create({
    userId: new Types.ObjectId(userId),
    symptoms: payload.symptoms,
    severity: payload.severity,
    note: payload.note,
    loggedAt: payload.loggedAt ? new Date(payload.loggedAt) : new Date(),
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
