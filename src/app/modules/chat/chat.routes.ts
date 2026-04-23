import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { auth } from "../../middleware/auth";
import { ChatController } from "./chat.controller";

const router = express.Router();

// ─── Multer setup ─────────────────────────────────────────────────────────────

const uploadDir = "uploads/chat";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) =>
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
});

const fileFilter = (
  _req: express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowed = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "application/zip",
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("File type not allowed"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// All chat routes require patient or clinician role
const chatAuth = auth("patient", "clinician");

// ─── Conversations ────────────────────────────────────────────────────────────

// Get or create conversation (requires active connection)
router.post("/conversations", chatAuth, ChatController.getOrCreateConversation);

// Get all my conversations
router.get("/conversations", chatAuth, ChatController.getMyConversations);

// Get unread badge count
router.get("/unread-count", chatAuth, ChatController.getTotalUnreadCount);

// ─── Messages ─────────────────────────────────────────────────────────────────

// Get messages in a conversation (paginated)
router.get(
  "/conversations/:conversationId/messages",
  chatAuth,
  ChatController.getMessages
);

// Mark conversation as read
router.post(
  "/conversations/:conversationId/read",
  chatAuth,
  ChatController.markAsRead
);

// Send message (HTTP fallback — primary channel is Socket.IO)
router.post("/send", chatAuth, ChatController.sendMessage);

// Edit message
router.patch("/messages/:messageId", chatAuth, ChatController.editMessage);

// Delete message
router.delete("/messages/:messageId", chatAuth, ChatController.deleteMessage);

// ─── File Upload ──────────────────────────────────────────────────────────────

router.post(
  "/upload",
  chatAuth,
  upload.single("file"),
  (req: express.Request, res: express.Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const fileUrl     = `/uploads/chat/${req.file.filename}`;
    const messageType = req.file.mimetype.startsWith("image/")
      ? "image"
      : req.file.mimetype === "application/pdf"
      ? "pdf"
      : "file";

    res.json({
      success: true,
      message: "File uploaded successfully",
      data: {
        fileUrl,
        fileName:    req.file.originalname,
        fileSize:    req.file.size,
        messageType,
      },
    });
  }
);

export const ChatRoutes = router;