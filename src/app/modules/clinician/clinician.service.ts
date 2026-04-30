/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { Connection } from "../connection/connection.model";
import { User } from "../user/user.model";
import { GutHealthScore } from "../score/score.model";
import { FoodLog } from "../foodLogs/foodLogs.model";
import { SymptomLog } from "../symptomLog/symptomLog.model";
import { DietPlan } from "../dietPlan/dietPlan.model";
import { SymptomLogService } from "../symptomLog/symptomLog.service";
import AppError from "../../error/appError";
import { FoodTags } from "../foodTags/foodTags.model";

// ─── Helper: verify clinician is connected to patient ────────────────────────
const _verifyConnection = async (clinicianId: string, patientId: string) => {
  const conn = await Connection.findOne({
    clinicianId: new Types.ObjectId(clinicianId),
    patientId: new Types.ObjectId(patientId),
    status: "active",
  });
  if (!conn) throw new AppError(403, "No active connection with this patient");
  return conn;
};

// ─── 1. Get All Connected Patients ───────────────────────────────────────────

const getMyPatients = async (
  clinicianId: string,
  query: { page?: number; limit?: number; search?: string },
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const connections = await Connection.find({
    clinicianId: new Types.ObjectId(clinicianId),
    status: "active",
  }).sort({ updatedAt: -1 });

  const patientIds = connections.map((c) => c.patientId);

  const userFilter: Record<string, any> = {
    _id: { $in: patientIds },
    role: "patient",
  };
  if (query.search) {
    userFilter.$or = [
      { name: new RegExp(query.search, "i") },
      { email: new RegExp(query.search, "i") },
    ];
  }

  const [patients, total] = await Promise.all([
    User.find(userFilter)
      .select("name email patientProfile createdAt")
      .skip(skip)
      .limit(limit),
    User.countDocuments(userFilter),
  ]);

  const enriched = await Promise.all(
    patients.map(async (p) => {
      const score = await GutHealthScore.findOne({ userId: p._id }).select(
        "score grade updatedAt",
      );

      const recentFlare = await SymptomLog.findOne({
        userId: p._id,
        severity: "Severe",
        loggedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      });

      const lastFoodLog = await FoodLog.findOne({ userId: p._id })
        .sort({ loggedAt: -1 })
        .limit(1);

      const lastLoggedFood = lastFoodLog
        ? lastFoodLog.foods
            .map((f: any) => f.raw_food || f.food_description)
            .join(", ")
        : "";

      return {
        _id: p._id,
        name: p.name,
        email: p.email,
        age: (p as any).patientProfile?.age,
        weight: (p as any).patientProfile?.weight,
        gutScore: score?.score ?? null,
        grade: score?.grade ?? null,
        scoreUpdatedAt: score?.updatedAt ?? null,
        hasFlareUp: !!recentFlare,
        connectedSince: connections.find(
          (c) => c.patientId.toString() === p._id.toString(),
        )?.updatedAt,
        lastLoggedFood,
      };
    }),
  );

  return {
    patients: enriched,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

// ─── 2. Patient Overview ──────────────────────────────────────────────────────

const getPatientOverview = async (clinicianId: string, patientId: string) => {
  await _verifyConnection(clinicianId, patientId);

  const [patient, scoreDoc, recentFoodLog, recentSymptom, dietPlan] =
    await Promise.all([
      User.findById(patientId).select("name email patientProfile createdAt"),
      GutHealthScore.findOne({ userId: new Types.ObjectId(patientId) }),
      FoodLog.findOne({ userId: new Types.ObjectId(patientId) }).sort({
        loggedAt: -1,
      }),
      SymptomLog.findOne({ userId: new Types.ObjectId(patientId) }).sort({
        loggedAt: -1,
      }),
      DietPlan.findOne({
        patientId: new Types.ObjectId(patientId),
        isActive: true,
      }).select("updatedAt"),
    ]);

  if (!patient) throw new AppError(404, "Patient not found");

  const recentActivity = [];
  if (recentSymptom) {
    recentActivity.push({
      type: "symptom",
      description: `${recentSymptom.symptoms.join(", ")} Logged`,
      severity: recentSymptom.severity,
      loggedAt: recentSymptom.loggedAt,
    });
  }
  if (recentFoodLog) {
    const foodNames = recentFoodLog.foods
      .map((f: any) => f.raw_food || f.food_description || "Food")
      .join(", ");
    recentActivity.push({
      type: "food",
      description: `Consumed: ${foodNames}`,
      mealType: recentFoodLog.mealType,
      loggedAt: recentFoodLog.loggedAt,
    });
  }

  const recentFlare = await SymptomLog.findOne({
    userId: new Types.ObjectId(patientId),
    severity: "Severe",
    loggedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  });

  return {
    patient: {
      _id: patient._id,
      name: patient.name,
      email: patient.email,
      age: (patient as any).patientProfile?.age,
      weight: (patient as any).patientProfile?.weight,
      gender: (patient as any).patientProfile?.gender,
      foodSensitivities: (patient as any).patientProfile?.foodSensitivities,
      symptoms: (patient as any).patientProfile?.symptoms,
      hasFlareUp: !!recentFlare,
    },
    gutHealthScore: scoreDoc
      ? {
          score: scoreDoc.score,
          grade: scoreDoc.grade,
          tagline: scoreDoc.tagline,
          updatedAt: scoreDoc.updatedAt,
          breakdown: scoreDoc.breakdown,
          concerns: scoreDoc.concerns,
          recommendations: scoreDoc.recommendations,
        }
      : null,
    recentActivity,
    hasDietPlan: !!dietPlan,
    dietPlanLastUpdated: dietPlan?.updatedAt ?? null,
  };
};

// ─── 3. Patient Food Logs ─────────────────────────────────────────────────────

const getPatientFoodLogs = async (
  clinicianId: string,
  patientId: string,
  query: { date?: string; mealType?: string; page?: number; limit?: number },
) => {
  await _verifyConnection(clinicianId, patientId);

  const filter: Record<string, any> = { userId: new Types.ObjectId(patientId) };
  if (query.date) {
    filter.loggedAt = {
      $gte: new Date(`${query.date}T00:00:00.000Z`),
      $lte: new Date(`${query.date}T23:59:59.999Z`),
    };
  }
  if (query.mealType) filter.mealType = query.mealType;

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

// ─── 4. Patient Symptoms ──────────────────────────────────────────────────────

const getPatientSymptoms = async (
  clinicianId: string,
  patientId: string,
  query: { date?: string; page?: number; limit?: number },
) => {
  await _verifyConnection(clinicianId, patientId);

  const filter: Record<string, any> = { userId: new Types.ObjectId(patientId) };
  if (query.date) {
    filter.loggedAt = {
      $gte: new Date(`${query.date}T00:00:00.000Z`),
      $lte: new Date(`${query.date}T23:59:59.999Z`),
    };
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

// ─── 5. Patient Triggers ──────────────────────────────────────────────────────

const getPatientTriggers = async (
  clinicianId: string,
  patientId: string,
  query: { days?: number },
) => {
  await _verifyConnection(clinicianId, patientId);

  const days = Number(query.days ?? 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const uid = new Types.ObjectId(patientId);

  const [symptomLogs, foodLogs, patient, savedTags] = await Promise.all([
    SymptomLog.find({ userId: uid, loggedAt: { $gte: since } }).sort({
      loggedAt: -1,
    }),
    FoodLog.find({ userId: uid, loggedAt: { $gte: since } }),
    User.findById(patientId).select("patientProfile"),
    FoodTags.findOne({ userId: uid }).sort({ generatedAt: -1 }),
  ]);

  // ── 1. Detected Triggers ─────────────────────────────────────────────────
  // Use FoodTags AI categories (e.g. "Dairy and Egg Products", "Fast Foods")
  // Cross-reference against patient's known sensitivities
  const sensitivities: string[] =
    (patient as any)?.patientProfile?.foodSensitivities ?? [];

  // Map sensitivity words to USDA category keywords
  const SENSITIVITY_TO_CATEGORY: Record<string, string[]> = {
    Dairy: ["dairy", "egg", "milk", "cheese", "cream"],
    Gluten: ["cereal", "grain", "pasta", "bread", "baked", "wheat"],
    Spicy: ["spicy", "pepper", "chili", "condiment"],
    Fried: ["fast food", "snack", "fried"],
    Sugar: ["sweet", "candy", "beverage", "dessert", "sugars"],
    Caffeine: ["beverage", "coffee", "tea"],
    "Processed food": ["fast food", "snack", "processed"],
  };

  // Detected = sensitivity word whose USDA categories appear in FoodTags
  const aiCategories: string[] = (savedTags?.top_categories ?? []).map(
    (c: any) => c.category.toLowerCase(),
  );

  const detectedTriggers: {
    sensitivity: string;
    matchedCategory: string;
    severity: string;
  }[] = [];

  sensitivities.forEach((s) => {
    const keywords = SENSITIVITY_TO_CATEGORY[s] ?? [s.toLowerCase()];
    const matched = savedTags?.top_categories?.find((c: any) =>
      keywords.some((kw) => c.category.toLowerCase().includes(kw)),
    );
    if (matched) {
      detectedTriggers.push({
        sensitivity: s,
        matchedCategory: matched.category,
        severity: matched.severity,
      });
    }
  });

  // ── 2. Chart Data: Symptom Frequency by Food Category ────────────────────
  // Use actual FoodTags top_categories for the chart groups
  // Instead of guessing from raw_food names, use logged usda_ids per day
  // and map them to the categories from FoodTags

  // Build a map: usda_id → category name from food logs
  // We'll use the food log's food_description field which matches normalised_name
  const CHART_GROUPS = savedTags?.top_categories
    ?.slice(0, 6)
    .map((c: any) => c.category) ?? [
    "Dairy and Egg Products",
    "Cereal Grains and Pasta",
    "Baked Products",
    "Poultry Products",
    "Vegetables and Vegetable Products",
    "Fruits and Fruit Juices",
  ];

  // Map each day to which categories were consumed.
  // We correlate category labels with both logged food names and culprit foods.
  const dayToCategoriesMap: Record<string, Set<string>> = {};

  const CATEGORY_KEYWORD_HINTS: Record<string, string[]> = {
    sweets: ["sweet", "sugar", "dessert", "candy", "chocolate", "cake", "cookie"],
    "fast foods": ["burger", "pizza", "fries", "fried", "fast food", "shawarma"],
    "cereal grains and pasta": [
      "rice",
      "bread",
      "wheat",
      "grain",
      "pasta",
      "noodle",
      "oats",
      "flour",
    ],
    "fruits and fruit juices": ["fruit", "apple", "banana", "orange", "mango", "juice"],
    "finfish and shellfish products": ["fish", "salmon", "tuna", "shrimp", "prawn", "shellfish"],
    "dairy and egg products": ["milk", "cheese", "yogurt", "butter", "cream", "egg"],
  };

  const getCategoryKeywords = (category: string) => {
    const baseWords = category
      .toLowerCase()
      .split(/[\s,/&-]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2 && !["and", "with", "from", "the"].includes(w));

    const hinted = CATEGORY_KEYWORD_HINTS[category.toLowerCase()] ?? [];
    return [...new Set([...baseWords, ...hinted])];
  };

  const matchCategories = (text: string): string[] => {
    const normalizedText = text.toLowerCase();
    return CHART_GROUPS.filter((cat: string) =>
      getCategoryKeywords(cat).some((kw) => normalizedText.includes(kw)),
    );
  };

  const addCategoriesToDay = (dayKey: string, categories: string[]) => {
    if (!dayToCategoriesMap[dayKey]) dayToCategoriesMap[dayKey] = new Set();
    categories.forEach((cat) => dayToCategoriesMap[dayKey].add(cat));
  };

  foodLogs.forEach((log: any) => {
    const dayKey = new Date(log.loggedAt).toDateString();
    log.foods.forEach((food: any) => {
      const sourceText = [food.raw_food, food.food_description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!sourceText) return;
      addCategoriesToDay(dayKey, matchCategories(sourceText));
    });
  });

  // Culprit foods are strongly correlated with symptoms, so use them as
  // additional evidence for food-group mapping on each symptom day.
  symptomLogs.forEach((log: any) => {
    const dayKey = new Date(log.loggedAt).toDateString();
    (log.culpritFoods ?? []).forEach((food: any) => {
      const sourceText = String(food?.food_name ?? "").toLowerCase();
      if (!sourceText) return;
      addCategoriesToDay(dayKey, matchCategories(sourceText));
    });
  });

  // Count symptoms on days where each category was consumed
  const chartData = CHART_GROUPS.map((group: string) => {
    const daysWithGroup = Object.entries(dayToCategoriesMap)
      .filter(([, cats]) => cats.has(group))
      .map(([day]) => day);

    const countSymptoms = (symptoms: string[]) => {
      const normalizedTargets = symptoms.map((s) => s.toLowerCase());
      return symptomLogs.filter(
        (s) =>
          daysWithGroup.includes(new Date(s.loggedAt).toDateString()) &&
          s.symptoms.some((sym) =>
            normalizedTargets.includes(String(sym).toLowerCase()),
          ),
      ).length;
    };

    return {
      foodGroup: group,
      Bloating: countSymptoms(["Bloating"]),
      Gas: countSymptoms(["Gas", "Flatulence"]),
      Pain: countSymptoms([
        "Abdominal Pain",
        "Stomach Pain",
        "Pain",
        "Cramps",
        "Cramping",
      ]),
    };
  });

  // ── 3. Top Symptoms ───────────────────────────────────────────────────────
  const symptomCounts: Record<string, number> = {};
  symptomLogs.forEach((log) => {
    log.symptoms.forEach((s) => {
      symptomCounts[s] = (symptomCounts[s] ?? 0) + 1;
    });
  });

  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([symptom, count]) => ({ symptom, count }));

  return {
    detectedTriggers, // [{ sensitivity, matchedCategory, severity }]
    topSymptoms, // [{ symptom, count }]
    chartData, // [{ foodGroup, Bloating, Gas, Pain }]
    aiCategories: savedTags?.top_categories ?? [], // full AI tag data
    periodDays: days,
    totalFoodLogs: foodLogs.length,
    totalSymptomLogs: symptomLogs.length,
    hasFoodTagsData: !!savedTags,
    foodTagsGeneratedAt: savedTags?.generatedAt ?? null,
  };
};

// ─── 6. Patient Weekly Symptom Trend ─────────────────────────────────────────

const getPatientWeeklyTrend = async (
  clinicianId: string,
  patientId: string,
) => {
  await _verifyConnection(clinicianId, patientId);
  // Reuse the same logic from SymptomLogService, just pass the patientId
  return SymptomLogService.getWeeklyTrend(patientId);
};

export const ClinicianService = {
  getMyPatients,
  getPatientOverview,
  getPatientFoodLogs,
  getPatientSymptoms,
  getPatientTriggers,
  getPatientWeeklyTrend,
};
