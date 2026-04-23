/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { ChatService } from "./chat.service";

const getRole = (req: Request): "patient" | "clinician" =>
  (req as any).user.role === "patient" ? "patient" : "clinician";

const getUserId = (req: Request): string => (req as any).user.userId;

// GET or CREATE conversation with another user
const getOrCreateConversation = catchAsync(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const userRole = getRole(req);
    const { otherUserId } = req.body;
    const result = await ChatService.getOrCreateConversation(
      userId,
      userRole,
      otherUserId,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Conversation ready",
      data: result,
    });
  },
);

// Get all my conversations
const getMyConversations = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const userRole = getRole(req);

  const { search } = req.query;

  const result = await ChatService.getMyConversations(
    userId,
    userRole,
    search as string,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Conversations retrieved",
    data: result,
  });
});

// Get messages in a conversation (paginated)
const getMessages = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { conversationId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 30;
  const result = await ChatService.getMessages(
    conversationId,
    userId,
    page,
    limit,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Messages retrieved",
    data: result,
  });
});

// Send message (HTTP fallback — socket is primary)
const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const senderId = getUserId(req);
  const senderRole = getRole(req);
  const result = await ChatService.sendMessage({
    ...req.body,
    senderId,
    senderRole,
  });
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Message sent",
    data: result,
  });
});

// Edit message
const editMessage = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { messageId } = req.params;
  const { content } = req.body;
  const result = await ChatService.editMessage(messageId, userId, content);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Message edited",
    data: result,
  });
});

// Delete message
const deleteMessage = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { messageId } = req.params;
  const { deleteFor } = req.body;
  const result = await ChatService.deleteMessage(messageId, userId, deleteFor);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Message deleted",
    data: result,
  });
});

// Mark conversation as read
const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { conversationId } = req.params;
  await ChatService.markAsRead(conversationId, userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Marked as read",
    data: null,
  });
});

// Get total unread count (badge)
const getTotalUnreadCount = catchAsync(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const result = await ChatService.getTotalUnreadCount(userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Unread count",
    data: { unreadCount: result },
  });
});

export const ChatController = {
  getOrCreateConversation,
  getMyConversations,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,
  getTotalUnreadCount,
};
