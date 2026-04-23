import { Types } from "mongoose";

export type TMessageType = "text" | "image" | "pdf" | "file";
export type TMessageStatus = "sent" | "delivered" | "read";

export interface IChatMessage {
  conversationId: Types.ObjectId;
  senderId:   Types.ObjectId; // User._id
  receiverId: Types.ObjectId; // User._id
  senderRole:   "patient" | "clinician";
  receiverRole: "patient" | "clinician";

  content:     string;
  messageType: TMessageType;

  // File fields
  fileUrl?:  string;
  fileName?: string;
  fileSize?: number;

  status:    TMessageStatus;
  isEdited:  boolean;
  isDeleted: boolean;
  deletedFor: Types.ObjectId[];
  readAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IConversation {
  patientId:   Types.ObjectId;
  clinicianId: Types.ObjectId;
  connectionId: Types.ObjectId; // ref to approved Connection

  lastMessage?:   Types.ObjectId;
  lastMessageAt?: Date;

  unreadCounts: {
    userId: Types.ObjectId;
    count:  number;
  }[];

  createdAt?: Date;
  updatedAt?: Date;
}