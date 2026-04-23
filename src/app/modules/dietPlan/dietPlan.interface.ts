import { Types } from "mongoose";

export interface IMealSuggestion {
  mealType: string;
  foodSuggestion: string;
}

export interface IDietPlan {
  patientId:   Types.ObjectId;
  clinicianId: Types.ObjectId;

  // General Guidelines
  foodsToAvoid:    string[];
  foodsToIncrease: string[];
  additionalNotes: string;

  // Meal Suggestions
  mealSuggestions: IMealSuggestion[];

  isActive:   boolean;
  notifiedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}