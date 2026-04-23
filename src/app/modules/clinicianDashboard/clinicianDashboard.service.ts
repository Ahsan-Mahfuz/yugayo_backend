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

// ─── Helper: get all patientIds connected to this clinician ──────────────────
const _getConnectedPatientIds = async (clinicianId: string) => {
  const connections = await Connection.find({
    clinicianId: new Types.ObjectId(clinicianId),
    status: "active",
  }).select("patientId");
  return connections.map((c) => c.patientId);
};

// ─── 1. Dashboard Summary ─────────────────────────────────────────────────────
/**
 * Returns:
 *  - totalPatients
 *  - activeToday      (patients who logged food OR symptom today)
 *  - severeSymptomsCount  (patients with a Severe symptom log today)
 *  - atRiskCount      (patients whose gut score < 40)
 */
const getDashboardSummary = async (clinicianId: string) => {
  const patientIds = await _getConnectedPatientIds(clinicianId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Active today: logged food OR symptom today
  const [activeFoodUserIds, activeSymptomUserIds] = await Promise.all([
    FoodLog.distinct("userId", {
      userId: { $in: patientIds },
      loggedAt: { $gte: todayStart },
    }),
    SymptomLog.distinct("userId", {
      userId: { $in: patientIds },
      loggedAt: { $gte: todayStart },
    }),
  ]);

  const activeSet = new Set([
    ...activeFoodUserIds.map(String),
    ...activeSymptomUserIds.map(String),
  ]);

  // Severe symptom patients today
  const severePatients = await SymptomLog.distinct("userId", {
    userId: { $in: patientIds },
    severity: "Severe",
    loggedAt: { $gte: todayStart },
  });

  // At-risk: score < 40
  const atRiskScores = await GutHealthScore.find({
    userId: { $in: patientIds },
    score: { $lt: 40 },
  }).select("userId");

  return {
    totalPatients: patientIds.length,
    activeToday: activeSet.size,
    severeSymptomsCount: severePatients.length,
    atRiskCount: atRiskScores.length,
  };
};

// ─── 2. Recent Alerts (severe symptom logs from connected patients) ───────────
const getRecentAlerts = async (
  clinicianId: string,
  query: { limit?: number; page?: number },
) => {
  const patientIds = await _getConnectedPatientIds(clinicianId);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const [alerts, total] = await Promise.all([
    SymptomLog.find({
      userId: { $in: patientIds },
      severity: "Severe",
    })
      .sort({ loggedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email"),
    SymptomLog.countDocuments({
      userId: { $in: patientIds },
      severity: "Severe",
    }),
  ]);

  const formatted = alerts.map((log) => {
    const patient = log.userId as any;
    return {
      alertId: log._id,
      patient: {
        _id: patient._id,
        name: patient.name,
        email: patient.email,
      },
      symptoms: log.symptoms,
      severity: log.severity,
      note: log.note,
      summary: log.summary,
      loggedAt: log.loggedAt,
      timeAgo: _timeAgo(log.loggedAt),
    };
  });

  return {
    alerts: formatted,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

// ─── 3. Recent Activity (food logs + symptom logs merged) ────────────────────
const getRecentActivity = async (
  clinicianId: string,
  query: { limit?: number; page?: number },
) => {
  const patientIds = await _getConnectedPatientIds(clinicianId);

  const limit = query.limit ?? 20;
  const page = query.page ?? 1;
  const skip = (page - 1) * limit;

  // Fetch both in parallel
  const [foodLogs, symptomLogs] = await Promise.all([
    FoodLog.find({ userId: { $in: patientIds } })
      .sort({ loggedAt: -1 })
      .limit(limit * 2)
      .populate("userId", "name email"),
    SymptomLog.find({ userId: { $in: patientIds } })
      .sort({ loggedAt: -1 })
      .limit(limit * 2)
      .populate("userId", "name email"),
  ]);

  // Merge and sort by loggedAt desc
  const merged: any[] = [
    ...foodLogs.map((f) => {
      const patient = f.userId as any;
      const foodNames = f.foods
        .map((x: any) => x.raw_food || x.food_description || "Food")
        .join(", ");
      return {
        type: "food",
        activityId: f._id,
        patient: { _id: patient._id, name: patient.name, email: patient.email },
        description: `Logged meal: ${foodNames}`,
        mealType: f.mealType,
        loggedAt: f.loggedAt,
        timeAgo: _timeAgo(f.loggedAt),
      };
    }),
    ...symptomLogs.map((s) => {
      const patient = s.userId as any;
      return {
        type: "symptom",
        activityId: s._id,
        patient: { _id: patient._id, name: patient.name, email: patient.email },
        description: `Logged symptoms: ${s.symptoms.join(", ")}`,
        severity: s.severity,
        loggedAt: s.loggedAt,
        timeAgo: _timeAgo(s.loggedAt),
      };
    }),
  ]
    .sort(
      (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
    )
    .slice(skip, skip + limit);

  return {
    activities: merged,
    pagination: {
      page,
      limit,
      // approximate total
    },
  };
};

// ─── 4. At-Risk Patients List ────────────────────────────────────────────────
const getAtRiskPatients = async (clinicianId: string) => {
  const patientIds = await _getConnectedPatientIds(clinicianId);

  const atRiskScores = await GutHealthScore.find({
    userId: { $in: patientIds },
    score: { $lt: 40 },
  })
    .populate("userId", "name email patientProfile")
    .sort({ score: 1 });

  return atRiskScores.map((s) => {
    const user = s.userId as any;
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      age: user.patientProfile?.age,
      healthScore: s.score,
      grade: s.grade,
      tagline: s.tagline,
    };
  });
};

// ─── Score → status label ─────────────────────────────────────────────────────
// Flare-up : score < 40
// At Risk  : score 40–64
// Stable   : score 65–100
const _scoreToStatus = (
  score: number | null,
): "stable" | "at-risk" | "flare-up" => {
  if (score === null || score < 40) return "flare-up";
  if (score < 65) return "at-risk";
  return "stable";
};

// ─── 5. Get All Connected Patients ───────────────────────────────────────────
const getMyPatients = async (
  clinicianId: string,
  query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: "stable" | "at-risk" | "flare-up";
  },
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

  // Fetch all matching patients first — status filter applied after score enrichment
  const patients = await User.find(userFilter).select(
    "name email patientProfile createdAt",
  );

  const enriched = await Promise.all(
    patients.map(async (p) => {
      const score = await GutHealthScore.findOne({ userId: p._id }).select(
        "score grade updatedAt",
      );

      const gutScore = score?.score ?? null;
      const status = _scoreToStatus(gutScore);

      const lastFoodLog = await FoodLog.findOne({ userId: p._id }).sort({
        loggedAt: -1,
      });

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
        gutScore,
        grade: score?.grade ?? null,
        status, // "Stable" | "At Risk" | "Flare-up"
        scoreUpdatedAt: score?.updatedAt ?? null,
        connectedSince: connections.find(
          (c) => c.patientId.toString() === p._id.toString(),
        )?.updatedAt,
        lastLoggedFood,
      };
    }),
  );

  // Apply status filter after enrichment (score lives in a separate collection)
  const filtered = query.status
    ? enriched.filter((p) => p.status === query.status)
    : enriched;

  // Manual pagination on the filtered set
  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + limit);

  return {
    patients: paginated,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

// ─── 6. Patient Overview ──────────────────────────────────────────────────────
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

// ─── 7. Patient Food Logs ─────────────────────────────────────────────────────
const getPatientFoodLogs = async (
  clinicianId: string,
  patientId: string,
  query: { date?: string; mealType?: string; page?: number; limit?: number },
) => {
  await _verifyConnection(clinicianId, patientId);

  const filter: Record<string, any> = {
    userId: new Types.ObjectId(patientId),
  };
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

// ─── 8. Patient Symptoms ──────────────────────────────────────────────────────
const getPatientSymptoms = async (
  clinicianId: string,
  patientId: string,
  query: { date?: string; severity?: string; page?: number; limit?: number },
) => {
  await _verifyConnection(clinicianId, patientId);

  const filter: Record<string, any> = {
    userId: new Types.ObjectId(patientId),
  };
  if (query.date) {
    filter.loggedAt = {
      $gte: new Date(`${query.date}T00:00:00.000Z`),
      $lte: new Date(`${query.date}T23:59:59.999Z`),
    };
  }
  if (query.severity) {
    filter.severity = query.severity; // "Mild" | "Moderate" | "Severe"
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

// ─── 9. Patient Triggers ──────────────────────────────────────────────────────
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

  const sensitivities: string[] =
    (patient as any)?.patientProfile?.foodSensitivities ?? [];

  const SENSITIVITY_TO_CATEGORY: Record<string, string[]> = {
    Dairy: ["dairy", "egg", "milk", "cheese", "cream"],
    Gluten: ["cereal", "grain", "pasta", "bread", "baked", "wheat"],
    Spicy: ["spicy", "pepper", "chili", "condiment"],
    Fried: ["fast food", "snack", "fried"],
    Sugar: ["sweet", "candy", "beverage", "dessert", "sugars"],
    Caffeine: ["beverage", "coffee", "tea"],
    "Processed food": ["fast food", "snack", "processed"],
  };

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

  const dayToCategoriesMap: Record<string, Set<string>> = {};

  foodLogs.forEach((log: any) => {
    const dayKey = new Date(log.loggedAt).toDateString();
    if (!dayToCategoriesMap[dayKey]) dayToCategoriesMap[dayKey] = new Set();

    log.foods.forEach((food: any) => {
      const foodName = (
        food.raw_food ||
        food.food_description ||
        ""
      ).toLowerCase();
      CHART_GROUPS.forEach((cat: string) => {
        const catWords = cat
          .toLowerCase()
          .split(/[\s,]+/)
          .filter((w: string) => w.length > 3);
        if (catWords.some((w: string) => foodName.includes(w))) {
          dayToCategoriesMap[dayKey].add(cat);
        }
      });
    });
  });

  const chartData = CHART_GROUPS.map((group: string) => {
    const daysWithGroup = Object.entries(dayToCategoriesMap)
      .filter(([, cats]) => cats.has(group))
      .map(([day]) => day);

    const countSymptoms = (symptoms: string[]) =>
      symptomLogs.filter(
        (s) =>
          daysWithGroup.includes(new Date(s.loggedAt).toDateString()) &&
          s.symptoms.some((sym) => symptoms.includes(sym)),
      ).length;

    return {
      foodGroup: group,
      Bloating: countSymptoms(["Bloating", "Gas", "Abdominal Pain"]),
      Gas: countSymptoms(["Gas"]),
      Pain: countSymptoms(["Abdominal Pain"]),
    };
  });

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
    detectedTriggers,
    topSymptoms,
    chartData,
    aiCategories: savedTags?.top_categories ?? [],
    periodDays: days,
    totalFoodLogs: foodLogs.length,
    totalSymptomLogs: symptomLogs.length,
    hasFoodTagsData: !!savedTags,
    foodTagsGeneratedAt: savedTags?.generatedAt ?? null,
  };
};

// ─── 10. Patient Weekly Trend ─────────────────────────────────────────────────
const getPatientWeeklyTrend = async (
  clinicianId: string,
  patientId: string,
) => {
  await _verifyConnection(clinicianId, patientId);
  return SymptomLogService.getWeeklyTrend(patientId);
};

// ─── Helper: time ago string ──────────────────────────────────────────────────
const _timeAgo = (date: Date): string => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.floor(hrs / 24)} days ago`;
};

export const ClinicianDashboardService = {
  getDashboardSummary,
  getRecentAlerts,
  getRecentActivity,
  getAtRiskPatients,
  getMyPatients,
  getPatientOverview,
  getPatientFoodLogs,
  getPatientSymptoms,
  getPatientTriggers,
  getPatientWeeklyTrend,
};
