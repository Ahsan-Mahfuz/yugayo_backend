/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { GentleNoteService } from "./gentleNote.service";

/**
 * POST /api/v1/gentle-note/generate
 *
 * Reads the patient's last 15 days of food + symptom logs from DB,
 * calls the AI /recommend/gentle_note endpoint, saves the result,
 * and returns it.
 */
const generateGentleNote = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await GentleNoteService.generateGentleNote(userId);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Gentle note generated successfully",
    data: result,
  });
});

/**
 * GET /api/v1/gentle-note/latest
 *
 * Returns the most recently saved gentle note for the patient.
 */
const getLatestGentleNote = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await GentleNoteService.getLatestGentleNote(userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Latest gentle note retrieved successfully",
    data: result,
  });
});

/**
 * GET /api/v1/gentle-note/history?page=1&limit=10
 *
 * Returns paginated history of all gentle notes for the patient.
 */
const getGentleNoteHistory = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await GentleNoteService.getGentleNoteHistory(userId, {
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 10,
  });
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Gentle note history retrieved successfully",
    data: result,
  });
});

export const GentleNoteController = {
  generateGentleNote,
  getLatestGentleNote,
  getGentleNoteHistory,
};
