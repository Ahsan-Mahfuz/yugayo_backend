import { z } from "zod";

export const sendConnectionRequestSchema = z.object({
  clinicianId: z.string().min(1, "Clinician ID is required"),
});

export const respondConnectionSchema = z.object({
  status: z.enum(["active", "rejected"]),
  rejectionReason: z.string().trim().optional(),
});