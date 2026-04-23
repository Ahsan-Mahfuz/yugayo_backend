import express from "express";
import {
  sendConnectionRequestSchema,
  respondConnectionSchema,
} from "./connection.validation";
import { ConnectionController } from "./connection.controller";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";

const router = express.Router();

// ─── Patient ──────────────────────────────────────────────────────────────────

// Browse all clinicians (to send request to)
router.get(
  "/clinicians",
  auth("patient"),
  ConnectionController.getAllClinicians
);

// Send a connection request to a clinician
router.post(
  "/request",
  auth("patient"),
  validateRequest(sendConnectionRequestSchema),
  ConnectionController.sendRequest
);

// Get my connections (pending / active / rejected)
router.get(
  "/my",
  auth("patient"),
  ConnectionController.getMyConnections
);

// ─── Clinician ────────────────────────────────────────────────────────────────

// Get my connected patients
router.get(
  "/my-patients",
  auth("clinician"),
  ConnectionController.getClinicianConnections
);

// ─── Admin ────────────────────────────────────────────────────────────────────

// Get all connections with stats (pending, active, rejected counts)
router.get(
  "/admin/all",
  auth("admin"),
  ConnectionController.getAllConnections
);

// Accept or reject a request
router.patch(
  "/admin/:connectionId/respond",
  auth("admin"),
  validateRequest(respondConnectionSchema),
  ConnectionController.respondToRequest
);

export const ConnectionRoutes = router;