import { Schema, model, Document } from "mongoose";
import { IConnection } from "./connection.interface";

export type IConnectionDocument = IConnection & Document;

const ConnectionSchema = new Schema<IConnectionDocument>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clinicianId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "rejected", "disconnected"],
      default: "pending",
      index: true,
    },
    requestedAt: { type: Date, default: Date.now },
    respondedAt:  { type: Date },
    respondedBy:  { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

// Prevent duplicate pending/active connections between same pair
ConnectionSchema.index({ patientId: 1, clinicianId: 1 });

export const Connection = model<IConnectionDocument>("Connection", ConnectionSchema);