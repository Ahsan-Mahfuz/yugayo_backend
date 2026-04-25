import { Types } from "mongoose";

export interface IGentleNoteAIResponse {
  note: string;
  symptoms_found: number;
  trigger_foods: number;
  cached: boolean;
}

export interface IGentleNote {
  userId: Types.ObjectId;
  note: string;
  symptoms_found: number;
  trigger_foods: number;
  cached: boolean;
  periodDays: number;
  generatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
