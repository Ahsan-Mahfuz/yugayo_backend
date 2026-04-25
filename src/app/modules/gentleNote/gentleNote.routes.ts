import express from "express";
import { auth } from "../../middleware/auth";
import { GentleNoteController } from "./gentleNote.controller";

const router = express.Router();

// All routes require a logged-in patient
router.use(auth("patient"));

/**
 * POST /api/v1/gentle-note/generate
 *
 * Automatically reads the patient's last 15 days of food + symptom logs,
 * calls the AI, saves the result, and returns it.
 * No request body needed — everything is pulled from the DB.
 */
router.post("/generate", GentleNoteController.generateGentleNote);

/**
 * GET /api/v1/gentle-note/latest
 *
 * Returns the most recently saved gentle note for the patient.
 * Use this to display the note on the home screen without regenerating.
 */
router.get("/latest", GentleNoteController.getLatestGentleNote);

/**
 * GET /api/v1/gentle-note/history?page=1&limit=10
 *
 * Paginated history of all previously generated gentle notes.
 */
router.get("/history", GentleNoteController.getGentleNoteHistory);

export const GentleNoteRoutes = router;