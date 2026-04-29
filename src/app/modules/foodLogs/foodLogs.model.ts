import { Schema, model, Document } from "mongoose";
import { IFoodLog } from "./foodLogs.interface";

export type IFoodLogDocument = IFoodLog & Document;

const FoodLogEntrySchema = new Schema(
  {
    usda_id:          { type: Number, required: true },
    quantity:         { type: Number, required: true },
    unit:             { type: String, required: true },
    food_description: { type: String },
    raw_food:         { type: String },
  },
  { _id: false }
);

const FoodLogSchema = new Schema<IFoodLogDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    logMethod: {
      type: String,
      enum: ["manual", "voice", "barcode"],
      required: true,
    },

    mealType: {
      type: String,
      enum: ["Breakfast", "Lunch", "Dinner", "Snack"],
      required: true,
    },

    foods: {
      type: [FoodLogEntrySchema],
      required: true,
    },

    rawText: { type: String }, // voice input only

    // AI scoring result
    previousScore: { type: Number },
    scoreModifier:  { type: Number },
    updatedScore:   { type: Number },
    grade:          { type: String },
    summary:        { type: String },
    foodDetails:    [{ type: Schema.Types.Mixed }],
    recommendations: [{ type: String }],

    loggedAt: { type: Date, default: Date.now, index: true },
    clientTimezone: { type: String },
    clientUtcOffsetMinutes: { type: Number },
    clientCountry: { type: String },
  },
  { timestamps: true }
);

// Compound index for fast per-user queries
FoodLogSchema.index({ userId: 1, loggedAt: -1 });

export const FoodLog = model<IFoodLogDocument>("FoodLog", FoodLogSchema);