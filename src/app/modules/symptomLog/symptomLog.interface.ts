import { Types } from "mongoose";

export type TSymptom =
  | "Bloating" | "Abdominal Pain" | "Nausea" | "Constipation"
  | "Heartburn" | "Gas" | "Fatigue" | "Acid Reflux" | "Cramps" | "Diarrhea";

export type TSeverity = "Mild" | "Moderate" | "Severe";

export interface ISymptomLogPayload {
  symptoms: TSymptom[];
  severity: TSeverity;
  note?: string;
  loggedAt?: string; // ISO datetime, defaults to now
}

export interface ISymptomLog {
  userId: Types.ObjectId;

  // What user submitted+
  symptoms: TSymptom[];
  severity: TSeverity;
  note?: string;
  loggedAt: Date;

  // AI response
  previousScore: number;
  scorePenalty: number;
  updatedScore: number;
  grade: string;
  summary: string;
  perSymptomDetails: Record<string, unknown>[];
  noteAnalysis?: Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}