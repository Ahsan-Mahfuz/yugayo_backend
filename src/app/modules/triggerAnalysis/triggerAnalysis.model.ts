import { Schema, model, Document } from "mongoose";
import { ITriggerAnalysis } from "./triggerAnalysis.interface";

export type ITriggerAnalysisDocument = ITriggerAnalysis & Document;

const TriggerInsightSchema = new Schema(
  {
    symptom_name: { type: String, required: true },
    trigger_foods: [{ type: String }],
    insight: { type: String },
  },
  { _id: false },
);

const TriggerAnalysisSchema = new Schema<ITriggerAnalysisDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    predictions: { type: Schema.Types.Mixed, required: true },
    insights: { type: [TriggerInsightSchema], default: [] },

    food_logs_processed: { type: Number, default: 0 },
    symptom_logs_processed: { type: Number, default: 0 },
    composite_meals_detected: { type: Number, default: 0 },
    evaluated_at: { type: String },

    periodDays: { type: Number, default: 90 },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// One document per user — always upsert latest
TriggerAnalysisSchema.index({ userId: 1, generatedAt: -1 });

export const TriggerAnalysis = model<ITriggerAnalysisDocument>(
  "TriggerAnalysis",
  TriggerAnalysisSchema,
);
