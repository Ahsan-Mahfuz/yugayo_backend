import { Schema, model, Document } from "mongoose";
import { ISymptomLog } from "./symptomLog.interface";

export type ISymptomLogDocument = ISymptomLog & Document;

export const CulpritFoodSchema = new Schema(
  {
    usda_id: { type: Number },
    food_name: { type: String },
    weight_g: { type: Number },
    hours_before: { type: Number },
    risk_level: { type: String },
    combined_risk: { type: Number },
    risk_nutrients: [{ type: String }],
  },
  { _id: false },
);

const SymptomLogSchema = new Schema<ISymptomLogDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    symptoms: [{ type: String, required: true }],
    severity: {
      type: String,
      enum: ["Mild", "Moderate", "Severe"],
      required: true,
    },
    note: { type: String },
    loggedAt: { type: Date, default: Date.now, index: true },

    // AI scoring result
    previousScore: { type: Number },
    scorePenalty: { type: Number },
    updatedScore: { type: Number },
    grade: { type: String },
    summary: { type: String },
    perSymptomDetails: [{ type: Schema.Types.Mixed }],
    noteAnalysis: { type: Schema.Types.Mixed },

    // Culprit foods from /recommend/symptom_culprit
    culpritFoods: { type: [CulpritFoodSchema], default: [] },
    culpritMessage: { type: String },
    clientTimezone: { type: String },
    clientUtcOffsetMinutes: { type: Number },
    clientCountry: { type: String },
  },
  { timestamps: true },
);

SymptomLogSchema.index({ userId: 1, loggedAt: -1 });

export const SymptomLog = model<ISymptomLogDocument>(
  "SymptomLog",
  SymptomLogSchema,
);
