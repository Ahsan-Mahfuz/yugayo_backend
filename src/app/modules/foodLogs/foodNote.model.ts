import { Schema, model, Document, Types } from "mongoose";

/** Culprit row from symptom_culprit — stored on symptom-sourced food notes. */
export interface ICulpritFoodNoteEntry {
  usda_id?: number;
  food_name?: string;
  weight_g?: number;
  hours_before?: number;
  risk_level?: string;
  combined_risk?: number;
  risk_nutrients?: string[];
}

const CulpritFoodNoteEntrySchema = new Schema<ICulpritFoodNoteEntry>(
  {
    usda_id: { type: Number },
    food_name: { type: String },
    weight_g: { type: Number },
    hours_before: { type: Number },
    risk_level: { type: String },
    combined_risk: { type: Number },
    risk_nutrients: [{ type: String }],
  },
  { _id: false },
);

export type TFoodNoteSource = "meal" | "symptom";

export interface IFoodNote {
  userId: Types.ObjectId;
  /** Present for meal-triggered notes and symptom notes tied to a resolved meal. */
  foodLogId?: Types.ObjectId;
  target_food: string;
  case?: string;
  /** AI food_note severity label (e.g. High), not the same as symptom log severity. */
  severity?: string;
  note?: string;
  cached: boolean;
  aiUnavailable: boolean;
  source?: TFoodNoteSource;
  /** When `source` is symptom — links to SymptomLog. */
  symptomLogId?: Types.ObjectId;
  symptoms?: string[];
  /** Symptom log severity: Mild | Moderate | Severe */
  symptomSeverity?: string;
  culpritFoods?: ICulpritFoodNoteEntry[];
  culpritMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IFoodNoteDocument = IFoodNote & Document;

const FoodNoteSchema = new Schema<IFoodNoteDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    foodLogId: {
      type: Schema.Types.ObjectId,
      ref: "FoodLog",
      required: false,
      index: true,
    },
    target_food: { type: String, required: true },
    case: { type: String },
    severity: { type: String },
    note: { type: String },
    cached: { type: Boolean, default: false },
    aiUnavailable: { type: Boolean, default: false },
    source: {
      type: String,
      enum: ["meal", "symptom"],
      default: "meal",
      index: true,
    },
    symptomLogId: {
      type: Schema.Types.ObjectId,
      ref: "SymptomLog",
      required: false,
      index: true,
    },
    symptoms: [{ type: String }],
    symptomSeverity: { type: String },
    culpritFoods: { type: [CulpritFoodNoteEntrySchema], default: undefined },
    culpritMessage: { type: String },
  },
  { timestamps: true },
);

FoodNoteSchema.index({ userId: 1, createdAt: -1 });

export const FoodNote = model<IFoodNoteDocument>("FoodNote", FoodNoteSchema);
