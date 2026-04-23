import { Schema, model, Document } from "mongoose";
import { IDietPlan } from "./dietPlan.interface";

export type IDietPlanDocument = IDietPlan & Document;

const MealSuggestionSchema = new Schema(
  {
    mealType:       { type: String, required: true },
    foodSuggestion: { type: String, required: true },
  },
  { _id: false }
);

const DietPlanSchema = new Schema<IDietPlanDocument>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clinicianId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    foodsToAvoid:    [{ type: String }],
    foodsToIncrease: [{ type: String }],
    additionalNotes: { type: String, default: "" },
    mealSuggestions: [MealSuggestionSchema],

    isActive:   { type: Boolean, default: true },
    notifiedAt: { type: Date },
  },
  { timestamps: true }
);

// One active plan per patient
DietPlanSchema.index({ patientId: 1, isActive: 1 });

export const DietPlan = model<IDietPlanDocument>("DietPlan", DietPlanSchema);