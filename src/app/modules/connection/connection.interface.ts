import { Types } from "mongoose";

export type TConnectionStatus = "pending" | "active" | "rejected" | "disconnected";

export interface IConnection {
  patientId: Types.ObjectId;   // User._id
  clinicianId: Types.ObjectId; // User._id
  status: TConnectionStatus;
  requestedAt: Date;
  respondedAt?: Date;
  respondedBy?: Types.ObjectId; // admin User._id
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}