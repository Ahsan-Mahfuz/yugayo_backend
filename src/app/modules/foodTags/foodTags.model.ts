import { Schema, model, Document } from "mongoose";
import { IFoodTags } from "./foodTags.interface";

export type IFoodTagsDocument = IFoodTags & Document;

const FoodTagCategorySchema = new Schema(
  {
    category: { type: String, required: true },
    food_count: { type: Number, required: true },
    insight: { type: String, required: true },
    severity: { type: String, enum: ["Low", "Medium", "High"], required: true },
  },
  { _id: false },
);

const FoodTagsSchema = new Schema<IFoodTagsDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    foods_analysed: { type: Number, required: true },
    categorised_count: { type: Number, required: true },
    top_categories: { type: [FoodTagCategorySchema], required: true },
    usda_ids_used: [{ type: Number }],
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// One latest result per user — always upsert
FoodTagsSchema.index({ userId: 1, generatedAt: -1 });

export const FoodTags = model<IFoodTagsDocument>("FoodTags", FoodTagsSchema);
