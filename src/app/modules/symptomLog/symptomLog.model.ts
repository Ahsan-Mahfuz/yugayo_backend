import { Schema, model, Document } from "mongoose";
import { ISymptomLog } from "./symptomLog.interface";

export type ISymptomLogDocument = ISymptomLog & Document;

const SymptomLogSchema = new Schema<ISymptomLogDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    symptoms: [{ type: String, required: true }],
    severity: {
      type: String,
      enum: ["Mild", "Moderate", "Severe"],
      required: true,
    },
    note:     { type: String },
    loggedAt: { type: Date, default: Date.now, index: true },

    // AI result
    previousScore:     { type: Number },
    scorePenalty:      { type: Number },
    updatedScore:      { type: Number },
    grade:             { type: String },
    summary:           { type: String },
    perSymptomDetails: [{ type: Schema.Types.Mixed }],
    noteAnalysis:      { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

SymptomLogSchema.index({ userId: 1, loggedAt: -1 });

export const SymptomLog = model<ISymptomLogDocument>("SymptomLog", SymptomLogSchema);