import { Types } from "mongoose";

export interface ISafeFood {
  userId: Types.ObjectId;
  safe_foods: string[];
  foods_analysed: number;
  composite_meals_detected: number;
  symptoms_considered: number;
  source_note: string;
  generatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
