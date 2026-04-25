import { Schema, model, Document } from "mongoose";
import { IGentleNote } from "./gentleNote.interface";

export type IGentleNoteDocument = IGentleNote & Document;

const GentleNoteSchema = new Schema<IGentleNoteDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    note:            { type: String, required: true },
    symptoms_found:  { type: Number, required: true },
    trigger_foods:   { type: Number, required: true },
    cached:          { type: Boolean, required: true },
    periodDays:      { type: Number, required: true },
    generatedAt:     { type: Date,   required: true },
  },
  { timestamps: true },
);

// Latest note per user fetched frequently
GentleNoteSchema.index({ userId: 1, generatedAt: -1 });

export const GentleNote = model<IGentleNoteDocument>(
  "GentleNote",
  GentleNoteSchema,
);