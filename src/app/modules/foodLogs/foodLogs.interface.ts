import { Types } from "mongoose";

export type TMealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";
export type TUnit =
  | "g"
  | "gram"
  | "kg"
  | "ml"
  | "l"
  | "oz"
  | "lb"
  | "piece"
  | "pieces"
  | "cup"
  | "tbsp"
  | "tsp"
  | "serving";
export type TLogMethod = "manual" | "voice" | "barcode";

// ─── Manual Entry ─────────────────────────────────────────────────────────────

export interface IManualFoodItem {
  foodName: string;
  quantity: number;
  unit: TUnit;
}

export interface IManualFoodLogPayload {
  foods: IManualFoodItem[];
  mealType: TMealType;
  clientTimezone?: string;
  clientUtcOffsetMinutes?: number;
  clientCountry?: string;
}

// ─── Voice Entry ──────────────────────────────────────────────────────────────

export interface IVoiceFoodLogPayload {
  text: string;
  clientTimezone?: string;
  clientUtcOffsetMinutes?: number;
  clientCountry?: string;
}

// ─── Barcode Entry ────────────────────────────────────────────────────────────

export interface IBarcodePayload {
  barcode: string; // raw barcode string from scanner
  mealType: TMealType;
  quantity?: number; // optional override (default 100)
  unit?: TUnit; // optional override (default "g")
  clientTimezone?: string;
  clientUtcOffsetMinutes?: number;
  clientCountry?: string;
}

// ─── Food Log Entry stored in DB ──────────────────────────────────────────────

export interface IFoodLogEntry {
  usda_id: number;
  quantity: number;
  unit: TUnit;
  food_description?: string;
  raw_food?: string;
  barcode?: string; // barcode logs only
  product_name?: string; // barcode logs only
}

// ─── Food Log Document ────────────────────────────────────────────────────────

export interface IFoodLog {
  userId: Types.ObjectId;
  logMethod: TLogMethod;
  mealType: TMealType;
  foods: IFoodLogEntry[];
  rawText?: string; // voice only
  barcodeValue?: string; // barcode only

  previousScore: number;
  scoreModifier: number;
  updatedScore: number;
  grade: string;
  summary: string;
  foodDetails: Record<string, unknown>[];
  recommendations: string[];

  loggedAt: Date;
  clientTimezone?: string;
  clientUtcOffsetMinutes?: number;
  clientCountry?: string;
  createdAt?: Date;
  updatedAt?: Date;
}


