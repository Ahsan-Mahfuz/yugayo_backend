/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { Conversation, ChatMessage } from "./chat.model";
import { Connection } from "../connection/connection.model";
import AppError from "../../error/appError";

// ─── Get or Create Conversation ──────────────────────────────────────────────
// Only allowed if an active connection exists between patient and clinician

const getOrCreateConversation = async (
  userId: string,
  userRole: "patient" | "clinician",
  otherUserId: string,
) => {
  const patientId = userRole === "patient" ? userId : otherUserId;
  const clinicianId = userRole === "clinician" ? userId : otherUserId;

  // Verify active connection exists
  const connection = await Connection.findOne({
    patientId: new Types.ObjectId(patientId),
    clinicianId: new Types.ObjectId(clinicianId),
    status: "active",
  });

  if (!connection) {
    throw new AppError(
      403,
      "No active connection found. Admin must approve the connection before chatting.",
    );
  }

  // Find or create conversation
  let conversation = await Conversation.findOne({
    patientId: new Types.ObjectId(patientId),
    clinicianId: new Types.ObjectId(clinicianId),
  });

  if (!conversation) {
    conversation = await Conversation.create({
      patientId: new Types.ObjectId(patientId),
      clinicianId: new Types.ObjectId(clinicianId),
      connectionId: connection._id,
      unreadCounts: [
        { userId: new Types.ObjectId(patientId), count: 0 },
        { userId: new Types.ObjectId(clinicianId), count: 0 },
      ],
    });
  }

  return conversation;
};

// ─── Get My Conversations ─────────────────────────────────────────────────────

const getMyConversations = async (
  userId: string,
  role: "patient" | "clinician",
  search?: string,
) => {
  const filter =
    role === "patient"
      ? { patientId: new Types.ObjectId(userId) }
      : { clinicianId: new Types.ObjectId(userId) };

  const conversations = await Conversation.find(filter)
    .populate("lastMessage")
    .populate("patientId", "name email patientProfile")
    .populate("clinicianId", "name email clinicianProfile")
    .sort({ lastMessageAt: -1, updatedAt: -1 });

  const filtered = conversations.filter((conv) => {
    const other =
      role === "patient" ? (conv.clinicianId as any) : (conv.patientId as any);

    if (!search) return true;

    const keyword = search.toLowerCase();

    return (
      other?.name?.toLowerCase().includes(keyword) ||
      other?.email?.toLowerCase().includes(keyword)
    );
  });

  return filtered.map((conv) => {
    const other =
      role === "patient" ? (conv.clinicianId as any) : (conv.patientId as any);

    const unread = conv.unreadCounts.find(
      (u) => u.userId.toString() === userId,
    );

    return {
      myId: userId,
      _id: conv._id,
      participant: other,
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageAt,
      unreadCount: unread?.count ?? 0,
    };
  });
};
// const getMyConversations = async (
//   userId: string,
//   role: "patient" | "clinician",
//   search?: string,
// ) => {
//   const filter =
//     role === "patient"
//       ? { patientId: new Types.ObjectId(userId) }
//       : { clinicianId: new Types.ObjectId(userId) };

//   const conversations = await Conversation.find(filter)
//     .populate("lastMessage")
//     .populate("patientId", "name email patientProfile")
//     .populate("clinicianId", "name email clinicianProfile")
//     .sort({ lastMessageAt: -1, updatedAt: -1 });

//   return conversations.map((conv) => {
//     const other =
//       role === "patient" ? (conv.clinicianId as any) : (conv.patientId as any);

//     const unread = conv.unreadCounts.find(
//       (u) => u.userId.toString() === userId,
//     );

//     return {
//       _id: conv._id,
//       participant: other,
//       lastMessage: conv.lastMessage,
//       lastMessageAt: conv.lastMessageAt,
//       unreadCount: unread?.count ?? 0,
//     };
//   });
// };

// ─── Get Messages ─────────────────────────────────────────────────────────────

const getMessages = async (
  conversationId: string,
  userId: string,
  page = 1,
  limit = 30,
) => {
  // Verify user is a participant
  const conv = await Conversation.findOne({
    _id: conversationId,
    $or: [
      { patientId: new Types.ObjectId(userId) },
      { clinicianId: new Types.ObjectId(userId) },
    ],
  });
  if (!conv) throw new AppError(403, "Access denied to this conversation");

  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    ChatMessage.find({
      conversationId,
      isDeleted: false,
      deletedFor: { $ne: new Types.ObjectId(userId) },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ChatMessage.countDocuments({
      conversationId,
      isDeleted: false,
      deletedFor: { $ne: new Types.ObjectId(userId) },
    }),
  ]);

  return {
    messages: messages.reverse(),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

// ─── Send Message ─────────────────────────────────────────────────────────────

const sendMessage = async (payload: {
  conversationId: string;
  senderId: string;
  receiverId: string;
  senderRole: "patient" | "clinician";
  receiverRole: "patient" | "clinician";
  content: string;
  messageType?: "text" | "image" | "pdf" | "file";
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}) => {
  console.log("[sendMessage] conversationId:", payload.conversationId);
  console.log("[sendMessage] senderId:", payload.senderId);

  const conv = await Conversation.findOne({
    _id: payload.conversationId,
    $or: [
      { patientId: new Types.ObjectId(payload.senderId) },
      { clinicianId: new Types.ObjectId(payload.senderId) },
    ],
  });

  console.log("[sendMessage] conv found:", !!conv);
  if (!conv) throw new AppError(403, "Access denied to this conversation");

  const message = await ChatMessage.create({
    conversationId: payload.conversationId,
    senderId: new Types.ObjectId(payload.senderId),
    receiverId: new Types.ObjectId(payload.receiverId),
    senderRole: payload.senderRole,
    receiverRole: payload.receiverRole,
    content: payload.content,
    messageType: payload.messageType ?? "text",
    fileUrl: payload.fileUrl,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    status: "sent",
  });

  // Update conversation last message + increment receiver unread count
  await Conversation.findByIdAndUpdate(
    payload.conversationId,
    {
      lastMessage: message._id,
      lastMessageAt: new Date(),
      $inc: { "unreadCounts.$[elem].count": 1 },
    },
    {
      arrayFilters: [{ "elem.userId": new Types.ObjectId(payload.receiverId) }],
    },
  );

  return message;
};

// ─── Edit Message ─────────────────────────────────────────────────────────────

const editMessage = async (
  messageId: string,
  senderId: string,
  content: string,
) => {
  const message = await ChatMessage.findOneAndUpdate(
    {
      _id: messageId,
      senderId: new Types.ObjectId(senderId),
      isDeleted: false,
    },
    { content, isEdited: true },
    { new: true },
  );
  if (!message) throw new AppError(404, "Message not found or access denied");
  return message;
};

// ─── Delete Message ───────────────────────────────────────────────────────────

const deleteMessage = async (
  messageId: string,
  userId: string,
  deleteFor: "me" | "everyone",
) => {
  if (deleteFor === "everyone") {
    const message = await ChatMessage.findOneAndUpdate(
      { _id: messageId, senderId: new Types.ObjectId(userId) },
      { isDeleted: true, content: "This message was deleted" },
      { new: true },
    );
    if (!message)
      throw new AppError(403, "Only the sender can delete for everyone");
    return message;
  } else {
    return ChatMessage.findByIdAndUpdate(
      messageId,
      { $addToSet: { deletedFor: new Types.ObjectId(userId) } },
      { new: true },
    );
  }
};

// ─── Mark as Read ─────────────────────────────────────────────────────────────

const markAsRead = async (conversationId: string, userId: string) => {
  await ChatMessage.updateMany(
    {
      conversationId,
      receiverId: new Types.ObjectId(userId),
      status: { $ne: "read" },
    },
    { status: "read", readAt: new Date() },
  );

  await Conversation.findByIdAndUpdate(
    conversationId,
    { $set: { "unreadCounts.$[elem].count": 0 } },
    { arrayFilters: [{ "elem.userId": new Types.ObjectId(userId) }] },
  );
};

// ─── Total Unread Count ───────────────────────────────────────────────────────

const getTotalUnreadCount = async (userId: string) => {
  const result = await Conversation.aggregate([
    {
      $match: {
        $or: [
          { patientId: new Types.ObjectId(userId) },
          { clinicianId: new Types.ObjectId(userId) },
        ],
      },
    },
    { $unwind: "$unreadCounts" },
    { $match: { "unreadCounts.userId": new Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: "$unreadCounts.count" } } },
  ]);
  return result[0]?.total ?? 0;
};

export const ChatService = {
  getOrCreateConversation,
  getMyConversations,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,
  getTotalUnreadCount,
};
