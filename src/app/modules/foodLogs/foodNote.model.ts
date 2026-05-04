import { Schema, model, Document, Types } from "mongoose";

export interface IFoodNote {
  userId: Types.ObjectId;
  foodLogId: Types.ObjectId;
  target_food: string;
  case?: string;
  severity?: string;
  note?: string;
  cached: boolean;
  aiUnavailable: boolean;
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
      required: true,
      index: true,
    },
    target_food: { type: String, required: true },
    case: { type: String },
    severity: { type: String },
    note: { type: String },
    cached: { type: Boolean, default: false },
    aiUnavailable: { type: Boolean, default: false },
  },
  { timestamps: true },
);

FoodNoteSchema.index({ userId: 1, createdAt: -1 });

export const FoodNote = model<IFoodNoteDocument>("FoodNote", FoodNoteSchema);
