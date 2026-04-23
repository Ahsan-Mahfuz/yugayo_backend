import { Types } from "mongoose";

export interface IFoodTagCategory {
  category:   string;
  food_count: number;
  insight:    string;
  severity:   "Low" | "Medium" | "High";
}

export interface IFoodTags {
  userId:            Types.ObjectId;
  foods_analysed:    number;
  categorised_count: number;
  top_categories:    IFoodTagCategory[];
  usda_ids_used:     number[];  // the ids sent to AI
  generatedAt:       Date;
  createdAt?:        Date;
  updatedAt?:        Date;
}