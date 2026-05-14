/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { FoodLog, IFoodLogDocument } from "./foodLogs.model";
import { FoodNote, IFoodNote } from "./foodNote.model";
import { SymptomLog } from "../symptomLog/symptomLog.model";
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
import { foodNotesQuerySchema } from "./foodLogs.validation";
import {
  displayNameForFoodEntry,
  foodNameForAiPayload,
} from "./foodEntryDisplayName";

const AI_BASE = config.ai_service_url as string;

/** Same unit map as gentleNote — payload weight_g for /recommend/food_note */
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

/** Same order as logged foods, e.g. "Banana Greek yogurt" for /recommend/food_note `target_food`. */
const _combinedTargetFoodString = (foods: IFoodLogEntry[]): string => {
  const parts: string[] = [];
  for (const f of foods) {
    const n = displayNameForFoodEntry(f).trim();
    if (n.length > 0) parts.push(n);
  }
  return parts.join(" ");
};

export type TFoodNoteClientPayload =
  | {
      target_food: string;
      case: string;
      severity: string;
      note: string;
      cached: boolean;
    }
  | { target_food: string; unavailable: true };

/** Last 3 months of food + symptoms in the shape expected by POST /recommend/food_note */
const _fetchHistoryForFoodNote = async (userId: string) => {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  threeMonthsAgo.setHours(0, 0, 0, 0);

  const uid = new Types.ObjectId(userId);
  const [foodLogs, symptomLogs] = await Promise.all([
    FoodLog.find({ userId: uid, loggedAt: { $gte: threeMonthsAgo } })
      .sort({ loggedAt: 1 })
      .lean(),
    SymptomLog.find({ userId: uid, loggedAt: { $gte: threeMonthsAgo } })
      .sort({ loggedAt: 1 })
      .lean(),
  ]);

  const food_logs = foodLogs.flatMap((log) =>
    ((log.foods as IFoodLogEntry[]) ?? []).map((food) => ({
      food_name: foodNameForAiPayload(food),
      weight_g: _toGrams(food.quantity ?? 100, food.unit ?? "g"),
      logged_at: new Date(log.loggedAt as Date).toISOString(),
    })),
  );

  const symptom_logs = symptomLogs.flatMap((log) =>
    (log.symptoms as string[]).map((symptom) => ({
      symptom,
      intensity: log.severity,
      logged_at: new Date(log.loggedAt as Date).toISOString(),
    })),
  );

  return { food_logs, symptom_logs };
};

const _requestFoodNote = async (body: {
  food_logs: { food_name: string; weight_g: number; logged_at: string }[];
  symptom_logs: { symptom: string; intensity: string; logged_at: string }[];
  target_food: string;
}): Promise<{
  target_food: string;
  case: string;
  severity: string;
  note: string;
  cached: boolean;
} | null> => {
  try {
    const res = await fetch(`${AI_BASE}/recommend/food_note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};

/**
 * After FoodLog is saved: one POST /recommend/food_note with combined `target_food` (e.g. "Banana Greek yogurt").
 * Never throws.
 */
const _foodNoteForNewLog = async (
  userId: string,
  foods: IFoodLogEntry[],
): Promise<TFoodNoteClientPayload> => {
  const target_food = _combinedTargetFoodString(foods);
  if (target_food.trim().length < 2) {
    return { target_food: target_food.trim() || "food", unavailable: true };
  }

  let food_logs: { food_name: string; weight_g: number; logged_at: string }[] =
    [];
  let symptom_logs: { symptom: string; intensity: string; logged_at: string }[] =
    [];
  try {
    const history = await _fetchHistoryForFoodNote(userId);
    food_logs = history.food_logs;
    symptom_logs = history.symptom_logs;
  } catch {
    return { target_food, unavailable: true };
  }

  const parsed = await _requestFoodNote({
    food_logs,
    symptom_logs,
    target_food,
  });
  if (parsed) {
    return {
      target_food: parsed.target_food ?? target_food,
      case: String(parsed.case ?? ""),
      severity: String(parsed.severity ?? ""),
      note: String(parsed.note ?? ""),
      cached: Boolean(parsed.cached),
    };
  }
  return { target_food, unavailable: true };
};

const _persistFoodNote = async (
  userId: string,
  foodLogId: Types.ObjectId,
  food_notes: TFoodNoteClientPayload,
) => {
  const base = {
    userId: new Types.ObjectId(userId),
    source: "meal" as const,
    foodLogId,
    target_food: food_notes.target_food,
    cached: "unavailable" in food_notes ? false : food_notes.cached,
    aiUnavailable: "unavailable" in food_notes && food_notes.unavailable === true,
  };
  if (!("unavailable" in food_notes)) {
    await FoodNote.create({
      ...base,
      case: food_notes.case,
      severity: food_notes.severity,
      note: food_notes.note,
    });
  } else {
    await FoodNote.create(base);
  }
};

/** 201 payload: `{ food_notes }` only; persists a FoodNote row for this meal. */
const _finalizeFoodLogResponse = async (userId: string, doc: IFoodLogDocument) => {
  let food_notes: TFoodNoteClientPayload;
  try {
    food_notes = await _foodNoteForNewLog(userId, doc.foods as IFoodLogEntry[]);
  } catch {
    food_notes = {
      target_food: _combinedTargetFoodString(doc.foods as IFoodLogEntry[]) || "food",
      unavailable: true,
    };
  }
  try {
    await _persistFoodNote(userId, doc._id as Types.ObjectId, food_notes);
  } catch {
    // DB write must not fail meal logging
  }
  return {
    food_notes,
    ...(doc.food_score != null && { food_score: doc.food_score }),
  };
};

/**
 * Same POST /recommend/food_note personalization as after a meal log, using the
 * combined meal label (e.g. "Banana Greek yogurt"). Mirrors `_foodNoteForNewLog`.
 * Never throws.
 */
export const requestFoodNoteForMealLog = async (
  userId: string,
  log: Pick<IFoodLogDocument, "foods">,
): Promise<TFoodNoteClientPayload> => {
  const target_food = _combinedTargetFoodString(log.foods as IFoodLogEntry[]);
  if (target_food.trim().length < 2) {
    return { target_food: target_food.trim() || "food", unavailable: true };
  }
  const trimmed = target_food.trim();
  try {
    const history = await _fetchHistoryForFoodNote(userId);
    const parsed = await _requestFoodNote({
      food_logs: history.food_logs,
      symptom_logs: history.symptom_logs,
      target_food: trimmed,
    });
    if (parsed) {
      return {
        target_food: parsed.target_food ?? trimmed,
        case: String(parsed.case ?? ""),
        severity: String(parsed.severity ?? ""),
        note: String(parsed.note ?? ""),
        cached: Boolean(parsed.cached),
      };
    }
  } catch {
    // fallthrough
  }
  return { target_food: trimmed, unavailable: true };
};

/** Persists like `_persistFoodNote`; errors are swallowed so callers never fail hard. */
export const persistFoodNoteForMeal = async (
  userId: string,
  foodLogId: Types.ObjectId,
  payload: TFoodNoteClientPayload,
) => {
  try {
    await _persistFoodNote(userId, foodLogId, payload);
  } catch {
    // DB write must not fail symptom / meal flows
  }
};

/** Symptom log → FoodNote: same AI note fields plus symptom/culprit snapshot (like POST /symptom-log). */
export const persistFoodNoteForSymptomCulprit = async (
  userId: string,
  args: {
    symptomLogId: Types.ObjectId;
    symptoms: string[];
    symptomSeverity: string;
    culpritFoods: any[];
    culpritMessage?: string;
    foodLogId?: Types.ObjectId | null;
    food_notes: TFoodNoteClientPayload;
  },
) => {
  try {
    const {
      food_notes,
      symptomLogId,
      symptoms,
      symptomSeverity,
      culpritFoods,
      culpritMessage,
      foodLogId,
    } = args;
    const uid = new Types.ObjectId(userId);
    const base: Omit<IFoodNote, "case" | "severity" | "note"> & {
      case?: string;
      severity?: string;
      note?: string;
    } = {
      userId: uid,
      source: "symptom",
      symptomLogId,
      symptoms,
      symptomSeverity,
      culpritFoods: culpritFoods ?? [],
      culpritMessage,
      target_food: food_notes.target_food,
      cached: "unavailable" in food_notes ? false : food_notes.cached,
      aiUnavailable: "unavailable" in food_notes && food_notes.unavailable === true,
      ...(foodLogId != null ? { foodLogId } : {}),
    };

    if (!("unavailable" in food_notes)) {
      const sev = String(food_notes.severity ?? "").trim();
      await FoodNote.create({
        ...base,
        case: food_notes.case,
        severity: sev || symptomSeverity,
        note: food_notes.note,
      });
    } else {
      await FoodNote.create({
        ...base,
        ...(symptomSeverity.trim()
          ? { severity: symptomSeverity.trim() }
          : {}),
      });
    }
  } catch {
    // DB write must not fail symptom flow
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Meal-level food score from AI JSON (`/log/food`, `/food/parse`, etc.).
 * Handles snake/camel/Pascal keys, numeric strings, optional `{ data }` wrappers.
 */
const _extractMealFoodScore = (raw: unknown): number | undefined => {
  const tryVal = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v.trim());
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  };

  const scanObject = (o: Record<string, unknown>): number | undefined => {
    const directKeys = [
      "food_score",
      "foodScore",
      "Food_score",
      "FoodScore",
      "FOOD_SCORE",
      "meal_food_score",
      "gut_food_score",
    ] as const;
    for (const k of directKeys) {
      const n = tryVal(o[k]);
      if (n !== undefined) return n;
    }
    const keys = [
      ...Reflect.ownKeys(o).filter((k): k is string => typeof k === "string"),
      ...Object.keys(o),
    ];
    const seen = new Set<string>();
    for (const key of keys) {
      if (seen.has(key)) continue;
      seen.add(key);
      const norm = key.replace(/[-_\s]/g, "").toLowerCase();
      if (norm === "foodscore" || norm === "mealfoodscore" || norm === "gutfoodscore") {
        const n = tryVal(o[key]);
        if (n !== undefined) return n;
      }
    }
    return undefined;
  };

  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    for (const el of raw) {
      const n = _extractMealFoodScore(el);
      if (n !== undefined) return n;
    }
    return undefined;
  }
  if (typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const fromRoot = scanObject(o);
  if (fromRoot !== undefined) return fromRoot;

  const inner = o.data ?? o.body ?? o.payload ?? o.result;
  if (inner != null && typeof inner === "object") {
    return _extractMealFoodScore(inner);
  }
  return undefined;
};

/**
 * Regex-scan raw JSON when parsed object does not expose `food_score` (encoding /
 * odd keys). Handles `"food_score"`, `"FoodScore"`, and small gaps between
 * `food` … `score` (e.g. rare Unicode homoglyphs in keys).
 */
const _extractMealFoodScoreFromRawJson = (rawJson: string): number | undefined => {
  if (!rawJson || typeof rawJson !== "string") return undefined;
  const normalized = rawJson.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-");
  const patterns = [
    /food[\s\S]{0,32}?score["']?\s*:\s*([-+]?\d+(?:\.\d+)?)/i,
    /["']food[_\s-]*score["']\s*:\s*([-+]?\d+(?:\.\d+)?)/i,
  ];
  for (const re of patterns) {
    const m = normalized.match(re);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};

/** Write normalised `food_score` onto a parsed AI object when discoverable. */
const _ensureFoodScoreOnParsed = (
  parsed: Record<string, unknown>,
  rawJsonText: string,
): void => {
  const fs =
    _extractMealFoodScore(parsed) ??
    _extractMealFoodScoreFromRawJson(rawJsonText);
  if (fs !== undefined) parsed.food_score = fs;
};

/** Normalise AI numeric values (JSON number, string, bigint). */
const _coerceAiNumber = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};

/**
 * $set `food_score` on the collection document so it is always stored in MongoDB,
 * even if a stale compiled Mongoose model would otherwise strip unknown paths.
 */
const _persistFoodScoreOnDocument = async (
  docId: Types.ObjectId,
  value: number | null,
): Promise<void> => {
  await FoodLog.collection.updateOne({ _id: docId }, { $set: { food_score: value } });
};

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

  try {
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
    const text = await res.text();
    const trimmed = text.replace(/^\uFEFF/, "").trim();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      throw new AppError(502, "AI /log/food returned invalid JSON");
    }
    _ensureFoodScoreOnParsed(data, trimmed);
    return data;
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const msg = err instanceof Error ? err.message : "Network error";
    throw new AppError(
      502,
      `AI /log/food failed (${msg}). Check that the AI service is running and AI_SERVICE_URL is correct.`,
    );
  }
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
) => {
  const base = {
    clientTimezone: payload.clientTimezone ?? requestMeta?.timezone,
    clientUtcOffsetMinutes:
      payload.clientUtcOffsetMinutes ?? requestMeta?.utcOffsetMinutes,
    clientCountry: payload.clientCountry ?? requestMeta?.country,
  };
  return Object.fromEntries(
    Object.entries(base).filter(([, v]) => v !== undefined),
  ) as {
    clientTimezone?: string;
    clientUtcOffsetMinutes?: number;
    clientCountry?: string;
  };
};

// ─── 1. Manual Entry ──────────────────────────────────────────────────────────

const manualLog = async (
  userId: string,
  payload: IManualFoodLogPayload,
  requestMeta?: {
    timezone?: string;
    utcOffsetMinutes?: number;
    country?: string;
  },
) => {
  const currentScore = await _getCurrentScore(userId);
  const foodEntries: IFoodLogEntry[] = [];
  let lastParsePayload: unknown;

  for (const item of payload.foods) {
    const parseBody: Record<string, unknown> = {
      text: item.foodName,
      top_k: 1,
    };
    if (payload.foods.length === 1) {
      parseBody.current_score = currentScore;
    }

    const parseRes = await fetch(`${AI_BASE}/food/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parseBody),
      signal: AbortSignal.timeout(15_000),
    });



    if (!parseRes.ok)
      throw new AppError(502, `Food parse failed for "${item.foodName}"`);

    const parseText = await parseRes.text();
    const parseTrimmed = parseText.replace(/^\uFEFF/, "").trim();
    let parseData: Record<string, unknown>;
    try {
      parseData = JSON.parse(parseTrimmed) as Record<string, unknown>;
    } catch {
      throw new AppError(502, `Food parse returned invalid JSON for "${item.foodName}"`);
    }
    _ensureFoodScoreOnParsed(parseData, parseTrimmed);
    lastParsePayload = parseData;
    const topResult = (
      parseData.results as
        | { usda_id?: number; normalised_name?: string }[]
        | undefined
    )?.[0];
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

  const clientMeta = _resolveClientMeta(payload, requestMeta);
  const lastParseStr =
    lastParsePayload != null && typeof lastParsePayload === "object"
      ? JSON.stringify(lastParsePayload)
      : "";
  const resolvedFoodScore: number | null =
    _coerceAiNumber((aiResult as Record<string, unknown>).food_score) ??
    _extractMealFoodScore(aiResult) ??
    _extractMealFoodScoreFromRawJson(JSON.stringify(aiResult)) ??
    (payload.foods.length === 1
      ? _extractMealFoodScore(lastParsePayload) ??
        _extractMealFoodScoreFromRawJson(lastParseStr)
      : undefined) ??
    null;

  const doc = await FoodLog.create({
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
    ...clientMeta,
  });
  await _persistFoodScoreOnDocument(doc._id as Types.ObjectId, resolvedFoodScore);
  (doc as unknown as { food_score: number | null }).food_score = resolvedFoodScore;
  return _finalizeFoodLogResponse(userId, doc);
};

// ─── 2. Voice Entry ───────────────────────────────────────────────────────────
// POST /food/parse with current_score → returns results + updated_score + note directly

const voiceLog = async (
  userId: string,
  payload: IVoiceFoodLogPayload,
  requestMeta?: {
    timezone?: string;
    utcOffsetMinutes?: number;
    country?: string;
  },
) => {
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

  const parseText = await parseRes.text();
  const parseTrimmed = parseText.replace(/^\uFEFF/, "").trim();
  let parseData: Record<string, unknown>;
  try {
    parseData = JSON.parse(parseTrimmed) as Record<string, unknown>;
  } catch {
    throw new AppError(502, "Food parse returned invalid JSON");
  }
  _ensureFoodScoreOnParsed(parseData, parseTrimmed);

  const results = parseData.results as unknown[] | undefined;
  if (!results?.length) {
    throw new AppError(
      422,
      "No foods detected in the voice input. Please try again.",
    );
  }

  const detectedMealType: TMealType =
    (parseData.meal_type as TMealType) ?? "Snack";

  const foodEntries: IFoodLogEntry[] = (results as any[]).map((f: any) => ({
    usda_id: f.usda_id,
    quantity: f.weight_g ?? 100,
    unit: "g" as const,
    food_description: f.normalised_name,
    raw_food: f.normalised_name,
  }));

  const updatedScore = (parseData.updated_score as number) ?? currentScore;
  const scoreImpact = (parseData.score_impact as number) ?? 0;

  await _updateStoredScore(userId, updatedScore, _gradeFromScore(updatedScore));
  const clientMeta = _resolveClientMeta(payload, requestMeta);
  const resolvedFoodScore: number | null =
    _coerceAiNumber(parseData.food_score) ??
    _extractMealFoodScore(parseData) ??
    _extractMealFoodScoreFromRawJson(parseTrimmed) ??
    _extractMealFoodScoreFromRawJson(JSON.stringify(parseData)) ??
    null;

  const doc = await FoodLog.create({
    userId: new Types.ObjectId(userId),
    logMethod: "voice",
    mealType: detectedMealType,
    foods: foodEntries,
    rawText: payload.text,
    previousScore: currentScore,
    scoreModifier: scoreImpact,
    updatedScore,
    grade: _gradeFromScore(updatedScore),
    summary: (parseData.note as string) ?? "",
    foodDetails: Array.isArray(parseData.results) ? parseData.results : [],
    recommendations: [],
    loggedAt: new Date(),
    ...clientMeta,
  });
  await _persistFoodScoreOnDocument(doc._id as Types.ObjectId, resolvedFoodScore);
  (doc as unknown as { food_score: number | null }).food_score = resolvedFoodScore;
  return _finalizeFoodLogResponse(userId, doc);
};

// ─── 3. Barcode Scan ──────────────────────────────────────────────────────────
// Flow: POST /scan/barcode → product_name
//       → POST /log/food with product_name directly (skip /food/parse if usda not needed)
//       → save to DB

const barcodeLog = async (
  userId: string,
  payload: IBarcodePayload,
  requestMeta?: {
    timezone?: string;
    utcOffsetMinutes?: number;
    country?: string;
  },
) => {
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

  let barcodeParsePayload: unknown = undefined;
  try {
    const parseRes = await fetch(`${AI_BASE}/food/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: productName,
        top_k: 1,
        current_score: currentScore,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (parseRes.ok) {
      const parseText = await parseRes.text();
      const parseTrimmed = parseText.replace(/^\uFEFF/, "").trim();
      try {
        const parseData = JSON.parse(parseTrimmed) as Record<string, unknown>;
        _ensureFoodScoreOnParsed(parseData, parseTrimmed);
        barcodeParsePayload = parseData;
        const topResult = (parseData.results as { usda_id?: number }[] | undefined)?.[0];
        if (topResult?.usda_id) {
          usda_id = topResult.usda_id;
          normalisedName = (topResult as { normalised_name?: string }).normalised_name ?? productName;
        }
      } catch {
        // ignore invalid parse JSON
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
  const clientMeta = _resolveClientMeta(payload, requestMeta);
  const barcodeParseStr =
    barcodeParsePayload != null && typeof barcodeParsePayload === "object"
      ? JSON.stringify(barcodeParsePayload)
      : "";
  const resolvedFoodScore: number | null =
    _coerceAiNumber((aiResult as Record<string, unknown>).food_score) ??
    _extractMealFoodScore(aiResult) ??
    _extractMealFoodScoreFromRawJson(JSON.stringify(aiResult)) ??
    _extractMealFoodScore(barcodeParsePayload) ??
    _extractMealFoodScoreFromRawJson(barcodeParseStr) ??
    null;

  // ── Step 4: Save to DB ────────────────────────────────────────────────────
  const doc = await FoodLog.create({
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
    ...clientMeta,
  });
  await _persistFoodScoreOnDocument(doc._id as Types.ObjectId, resolvedFoodScore);
  (doc as unknown as { food_score: number | null }).food_score = resolvedFoodScore;
  return _finalizeFoodLogResponse(userId, doc);
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

  const [docs, total] = await Promise.all([
    FoodLog.find(filter).sort({ loggedAt: -1 }).skip(skip).limit(limit),
    FoodLog.countDocuments(filter),
  ]);

  const logs = docs.map((doc) => {
    const o = doc.toObject() as Record<string, unknown> & {
      food_score?: number;
    };
    return { ...o, food_score: o.food_score ?? null };
  });

  return {
    logs,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

/** Saved personalised food notes (newest first). Optional `days=7|30` = rolling window on createdAt. */
const getMyFoodNotes = async (userId: string, query: Record<string, unknown>) => {
  const parsed = foodNotesQuerySchema.safeParse(query);
  const page = parsed.success ? parsed.data.page : 1;
  const limit = parsed.success ? parsed.data.limit : 20;
  const days = parsed.success ? parsed.data.days : undefined;
  const skip = (page - 1) * limit;
  const uid = new Types.ObjectId(userId);

  const filter: Record<string, unknown> = { userId: uid };
  if (days === 7 || days === 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    filter.createdAt = { $gte: since };
  }

  const [items, total] = await Promise.all([
    FoodNote.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FoodNote.countDocuments(filter),
  ]);


  console.log("items=========================", items);

  return {
    food_notes: items.map((row) => ({
      _id: String(row._id),
      foodLogId: row.foodLogId != null ? String(row.foodLogId) : null,
      target_food: row.target_food,
      case: row.case,
      severity: row.severity,
      note: row.note,
      cached: row.cached,
      aiUnavailable: row.aiUnavailable,
      createdAt: row.createdAt,
      source: row.source ?? "meal",
      ...(row.source === "symptom" && {
        symptomLogId:
          row.symptomLogId != null ? String(row.symptomLogId) : undefined,
        symptoms: row.symptoms ?? [],
        symptomSeverity: row.symptomSeverity,
        culpritFoods: row.culpritFoods ?? [],
        culpritMessage: row.culpritMessage,
      }),
    })),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const FoodLogService = {
  manualLog,
  voiceLog,
  barcodeLog,
  getMyLogs,
  getMyFoodNotes,
};
