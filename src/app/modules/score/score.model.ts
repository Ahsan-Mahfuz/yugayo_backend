import { Schema, model, Document, Types } from "mongoose";

export interface IScoreConcern {
  category: string;
  description: string;
}

export interface IScoreRecommendation {
  priority: number;
  advice: string;
}

export interface IScoreBreakdown {
  base_score: number;
  age_penalty: number;
  sleep_penalty: number;
  weight_penalty: number;
  gender_penalty: number;
  food_penalty: number;
  symptom_penalty: number;
  compound_penalty: number;
  final_score: number;
}

export interface IGutHealthScore extends Document {
  userId: Types.ObjectId;

  // Core result
  score: number;
  grade: string;
  tagline: string;

  // Full AI response stored for detail view
  breakdown: IScoreBreakdown;
  concerns: IScoreConcern[];
  recommendations: IScoreRecommendation[];

  // Snapshot of what was sent to AI (for audit / re-calculation)
  inputSnapshot: {
    gender: string;
    age: number;
    sleep_hours: number;
    weight_kg: number;
    foods: string[];
    symptoms: string[];
  };

  createdAt: Date;
  updatedAt: Date;
}

const ScoreBreakdownSchema = new Schema(
  {
    base_score: { type: Number },
    age_penalty: { type: Number },
    sleep_penalty: { type: Number },
    weight_penalty: { type: Number },
    gender_penalty: { type: Number },
    food_penalty: { type: Number },
    symptom_penalty: { type: Number },
    compound_penalty: { type: Number },
    final_score: { type: Number },
  },
  { _id: false },
);

const GutHealthScoreSchema = new Schema<IGutHealthScore>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one onboarding score per user
      index: true,
    },

    score: { type: Number, required: true, min: 0, max: 100 },
    grade: { type: String, required: true },
    tagline: { type: String },

    breakdown: { type: ScoreBreakdownSchema },
    concerns: [{ category: String, description: String }],
    recommendations: [{ priority: Number, advice: String }],

    inputSnapshot: {
      gender: String,
      age: Number,
      sleep_hours: Number,
      weight_kg: Number,
      foods: [String],
      symptoms: [String],
    },
  },
  { timestamps: true },
);

export const GutHealthScore = model<IGutHealthScore>(
  "GutHealthScore",
  GutHealthScoreSchema,
);
