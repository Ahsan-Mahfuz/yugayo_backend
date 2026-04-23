/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { User } from "../user/user.model";
import { Connection } from "../connection/connection.model";
import { GutHealthScore } from "../score/score.model";

const getAllClinicians = async (query: {
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter: any = {
    role: "clinician",
  };

  if (query.search) {
    filter.$or = [
      { name: new RegExp(query.search, "i") },
      { email: new RegExp(query.search, "i") },
    ];
  }

  const [clinicians, total] = await Promise.all([
    User.find(filter)
      .select("name email clinicianProfile createdAt")
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const enriched = await Promise.all(
    clinicians.map(async (c: any) => {
      // active patients count
      const patientsCount = await Connection.countDocuments({
        clinicianId: new Types.ObjectId(c._id),
        status: "active",
      });

      return {
        _id: c._id,
        name: c.name,
        email: c.email,
        specialty: c.clinicianProfile?.specialty || "General",
        experience: c.clinicianProfile?.experience || null,
        availability: c.clinicianProfile?.availability || "Unavailable",
        patients: patientsCount,
        createdAt: c.createdAt,
      };
    }),
  );

  // ─── Stats ─────────────────────────────
  const totalClinicians = total;

  const availableCount = enriched.filter(
    (c) => c.availability === "Available",
  ).length;

  const totalPatients = await Connection.countDocuments({
    status: "active",
  });

  return {
    clinicians: enriched,
    stats: {
      totalClinicians,
      available: availableCount,
      totalPatients,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getClinicianDetails = async (clinicianId: string) => {
  const clinician = await User.findById(clinicianId).select(
    "name email clinicianProfile",
  );

  if (!clinician) {
    throw new Error("Clinician not found");
  }

  // ─── Connections (patients) ─────────────────────
  const connections = await Connection.find({
    clinicianId: new Types.ObjectId(clinicianId),
    status: "active",
  }).lean();

  const patientIds = connections.map((c) => c.patientId);

  // ─── Patients info ──────────────────────────────
  const patients = await User.find({
    _id: { $in: patientIds },
  })
    .select("name email")
    .lean();

  // ─── Scores ─────────────────────────────────────
  const scores = await GutHealthScore.find({
    userId: { $in: patientIds },
  }).lean();

  const scoreMap = new Map(scores.map((s) => [s.userId.toString(), s]));

  // ─── Format patients ────────────────────────────
  const connectedPatients = patients.map((p) => {
    const scoreDoc = scoreMap.get(p._id.toString());

    return {
      _id: p._id,
      name: p.name,
      email: p.email,
      healthScore: scoreDoc?.score ?? 0,
      status: scoreDoc?.grade ?? "Flare-up",
    };
  });

  return {
    clinician: {
      _id: clinician._id,
      name: clinician.name,
      email: clinician.email,
      // specialty: clinician.clinicianProfile?.specialty || "General",
      // availability: clinician.clinicianProfile?.availability || "Unavailable",
      phone: clinician.clinicianProfile?.phone || "Not provided",
      location: clinician.clinicianProfile?.location || "Not provided",
      // experience: clinician.clinicianProfile?.experience || "N/A",
      // avatar: clinician.clinicianProfile?.avatar || null,
      connectedPatientsCount: connectedPatients.length,
    },
    connectedPatients,
  };
};

export const AdminService = {
  getAllClinicians,
  getClinicianDetails,
};
