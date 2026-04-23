import { Types } from "mongoose";

export interface ITriggerInsight {
  symptom_name: string;
  trigger_foods: string[];
  insight: string;
}

export interface ITriggerAnalysis {
  userId: Types.ObjectId;

  // Raw predictions from /recommend/risky_food
  predictions: Record<string, string[]>; // { bloating: ["Bananas", "Cabbage"] }

  // Enriched insights from /recommend/triggers_food (one per symptom)
  insights: ITriggerInsight[];

  // Stats from AI response
  food_logs_processed: number;
  symptom_logs_processed: number;
  composite_meals_detected: number;
  evaluated_at: string;

  periodDays: number;
  generatedAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}
