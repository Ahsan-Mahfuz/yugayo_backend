import { Schema, model, Document } from "mongoose";
import { IConversation, IChatMessage } from "./chat.interface";

// ─── Conversation ─────────────────────────────────────────────────────────────

export type IConversationDocument = IConversation & Document;

const ConversationSchema = new Schema<IConversationDocument>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clinicianId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    connectionId: {
      type: Schema.Types.ObjectId,
      ref: "Connection",
      required: true,
    },
    lastMessage:   { type: Schema.Types.ObjectId, ref: "ChatMessage" },
    lastMessageAt: { type: Date },
    unreadCounts: [
      {
        userId: { type: Schema.Types.ObjectId, required: true },
        count:  { type: Number, default: 0 },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

ConversationSchema.index({ patientId: 1, clinicianId: 1 }, { unique: true });

export const Conversation = model<IConversationDocument>(
  "Conversation",
  ConversationSchema
);

// ─── Message ──────────────────────────────────────────────────────────────────

export type IChatMessageDocument = IChatMessage & Document;

const ChatMessageSchema = new Schema<IChatMessageDocument>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["patient", "clinician"],
      required: true,
    },
    receiverRole: {
      type: String,
      enum: ["patient", "clinician"],
      required: true,
    },

    content:     { type: String, default: "" },
    messageType: {
      type: String,
      enum: ["text", "image", "pdf", "file"],
      default: "text",
    },

    fileUrl:  { type: String },
    fileName: { type: String },
    fileSize: { type: Number },

    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    isEdited:   { type: Boolean, default: false },
    isDeleted:  { type: Boolean, default: false },
    deletedFor: [{ type: Schema.Types.ObjectId }],
    readAt:     { type: Date },
  },
  { timestamps: true }
);

ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });

export const ChatMessage = model<IChatMessageDocument>(
  "ChatMessage",
  ChatMessageSchema
);