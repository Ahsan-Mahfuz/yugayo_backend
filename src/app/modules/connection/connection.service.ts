/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { Connection } from "./connection.model";
import { User } from "../user/user.model";
import AppError from "../../error/appError";
import { Conversation } from "../chat/chat.model";

// ─── Patient: Send Request ────────────────────────────────────────────────────

const sendRequest = async (patientId: string, clinicianId: string) => {
  // Check clinician exists
  const clinician = await User.findOne({ _id: clinicianId, role: "clinician" });
  if (!clinician) throw new AppError(404, "Clinician not found");

  // Check no active/pending connection already exists
  const existing = await Connection.findOne({
    patientId: new Types.ObjectId(patientId),
    clinicianId: new Types.ObjectId(clinicianId),
    status: { $in: ["pending", "active"] },
  });

  if (existing) {
    const msg =
      existing.status === "pending"
        ? "Connection request already sent"
        : "You are already connected with this clinician";
    throw new AppError(409, msg);
  }

  const connection = await Connection.create({
    patientId: new Types.ObjectId(patientId),
    clinicianId: new Types.ObjectId(clinicianId),
    requestedAt: new Date(),
  });

  return connection;
};

// ─── Admin: Get All Connections ───────────────────────────────────────────────

const getAllConnections = async (query: {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}) => {
  const filter: Record<string, any> = {};
  if (query.status) filter.status = query.status;

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const [connections, total] = await Promise.all([
    Connection.find(filter)
      .populate("patientId", "name email")
      .populate("clinicianId", "name email clinicianProfile")
      .populate("respondedBy", "name email")
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limit),
    Connection.countDocuments(filter),
  ]);

  // Stats
  const [pending, active, rejected] = await Promise.all([
    Connection.countDocuments({ status: "pending" }),
    Connection.countDocuments({ status: "active" }),
    Connection.countDocuments({ status: "rejected" }),
  ]);

  return {
    connections,
    stats: {
      total: await Connection.countDocuments(),
      pending,
      active,
      rejected,
    },
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Admin: Respond to Request ────────────────────────────────────────────────

const respondToRequest = async (
  connectionId: string,
  adminId: string,
  status: "active" | "rejected",
  rejectionReason?: string,
) => {
  const connection = await Connection.findById(connectionId);
  if (!connection) throw new AppError(404, "Connection request not found");

  if (connection.status !== "pending") {
    throw new AppError(400, `Request is already ${connection.status}`);
  }

  connection.status = status;
  connection.respondedAt = new Date();
  connection.respondedBy = new Types.ObjectId(adminId);

  if (rejectionReason) {
    connection.rejectionReason = rejectionReason;
  }

  await connection.save();

  // ─── 🔥 AUTO CREATE CONVERSATION ─────────────────────
  if (status === "active") {
    let conversation = await Conversation.findOne({
      patientId: connection.patientId,
      clinicianId: connection.clinicianId,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        patientId: connection.patientId,
        clinicianId: connection.clinicianId,
        connectionId: connection._id,
        unreadCounts: [
          { userId: connection.patientId, count: 0 },
          { userId: connection.clinicianId, count: 0 },
        ],
      });
    }

    // Return connection AND conversation so frontend gets conversationId
    return { connection, conversation };
  }

  return { connection, conversation: null };
};

// ─── Patient: Get My Connections ──────────────────────────────────────────────

const getMyConnections = async (patientId: string) => {
  return Connection.find({ patientId: new Types.ObjectId(patientId) })
    .populate("clinicianId", "name email clinicianProfile")
    .sort({ updatedAt: -1 });
};

// ─── Clinician: Get My Connections ────────────────────────────────────────────

const getClinicianConnections = async (clinicianId: string) => {
  return Connection.find({
    clinicianId: new Types.ObjectId(clinicianId),
    status: "active",
  })
    .populate("patientId", "name email patientProfile")
    .sort({ updatedAt: -1 });
};

// ─── Get All Clinicians (for patient to browse) ───────────────────────────────

const getAllClinicians = async (
  patientId: string,
  query: { page?: number; limit?: number; search?: string },
) => {
  const filter: Record<string, any> = { role: "clinician", isActive: true };
  if (query.search) {
    filter.$or = [
      { name: new RegExp(query.search, "i") },
      { "clinicianProfile.department": new RegExp(query.search, "i") },
    ];
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const [clinicians, total] = await Promise.all([
    User.find(filter)
      .select("name email clinicianProfile")
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  const connections = await Connection.find({
    patientId: new Types.ObjectId(patientId),
  }).select("clinicianId status");

  const requestMap = new Map();
  connections.forEach((conn) => {
    requestMap.set(conn.clinicianId.toString(), conn.status);
  });

  const enrichedClinicians = clinicians.map((clinician) => {
    const status = requestMap.get(clinician._id.toString());

    return {
      ...clinician.toObject(),
      isRequestSent: !!status && status !== "rejected",
      connectionStatus: status ?? "send",
    };
  });

  return {
    clinicians: enrichedClinicians,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ─── Check if two users are connected ────────────────────────────────────────

const isConnected = async (
  patientId: string,
  clinicianId: string,
): Promise<boolean> => {
  const conn = await Connection.findOne({
    patientId: new Types.ObjectId(patientId),
    clinicianId: new Types.ObjectId(clinicianId),
    status: "active",
  });
  return !!conn;
};

export const ConnectionService = {
  sendRequest,
  getAllConnections,
  respondToRequest,
  getMyConnections,
  getClinicianConnections,
  getAllClinicians,
  isConnected,
};
