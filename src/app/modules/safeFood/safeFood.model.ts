import { Schema, model, Document } from "mongoose";
import { ISafeFood } from "./safeFood.interface";

export type ISafeFoodDocument = ISafeFood & Document;

const SafeFoodSchema = new Schema<ISafeFoodDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    safe_foods: { type: [String], default: [] },
    foods_analysed: { type: Number, default: 0 },
    composite_meals_detected: { type: Number, default: 0 },
    symptoms_considered: { type: Number, default: 0 },
    source_note: { type: String },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// One record per user — upsert pattern used in service
SafeFoodSchema.index({ userId: 1 });

export const SafeFood = model<ISafeFoodDocument>("SafeFood", SafeFoodSchema);
