import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { ChatService } from "../modules/chat/chat.service";

// userId → socketId map for online presence
const onlineUsers = new Map<string, string>();

export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", 
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log("[Socket] Client connected:", socket.id);

    // ── User comes online ────────────────────────────────────────────────────
    socket.on("user:online", ({ userId }: { userId: string }) => {
      onlineUsers.set(userId, socket.id);
      socket.data.userId = userId;
      io.emit("users:online", Array.from(onlineUsers.keys()));
      console.log(`[Socket] user:online userId=${userId}`);
    });

    // ── Join a conversation room ──────────────────────────────────────────────
    socket.on(
      "conversation:join",
      ({ conversationId }: { conversationId: string }) => {
        socket.join(conversationId);
        console.log(`[Socket] joined room=${conversationId}`);
      },
    );

    // ── Leave a conversation room ─────────────────────────────────────────────
    socket.on(
      "conversation:leave",
      ({ conversationId }: { conversationId: string }) => {
        socket.leave(conversationId);
      },
    );

    // ── Send a message ────────────────────────────────────────────────────────
    socket.on(
      "message:send",
      async (payload: {
        conversationId: string;
        senderId: string; // User._id
        senderRole: "patient" | "clinician";
        receiverId: string; // User._id
        receiverRole: "patient" | "clinician";
        content: string;
        messageType?: "text" | "image" | "pdf" | "file";
        fileUrl?: string;
        fileName?: string;
        fileSize?: number;
        tempId?: string; // client-side optimistic ID
      }) => {
        console.log("[Socket] message:send:", payload.conversationId);

        try {
          const message = await ChatService.sendMessage({
            conversationId: payload.conversationId,
            senderId: payload.senderId,
            receiverId: payload.receiverId,
            senderRole: payload.senderRole,
            receiverRole: payload.receiverRole,
            content: payload.content,
            messageType: payload.messageType ?? "text",
            fileUrl: payload.fileUrl,
            fileName: payload.fileName,
            fileSize: payload.fileSize,
          });

          // Broadcast to everyone in the conversation room
          io.to(payload.conversationId).emit("message:new", {
            ...message.toObject(),
            tempId: payload.tempId,
          });

          // Notify receiver if they're online but not in this room
          const receiverSocketId = onlineUsers.get(payload.receiverId);
          if (receiverSocketId) {
            const receiverSocket = io.sockets.sockets.get(receiverSocketId);
            if (!receiverSocket?.rooms.has(payload.conversationId)) {
              io.to(receiverSocketId).emit("notification:message", {
                conversationId: payload.conversationId,
                senderId: payload.senderId,
                preview:
                  payload.messageType === "text"
                    ? payload.content.slice(0, 60)
                    : `Sent a ${payload.messageType}`,
              });
            }
          }
        } catch (err) {
          console.error("[Socket] message:send error:", err);
          socket.emit("message:error", { error: "Failed to send message" });
        }
      },
    );

    // ── Edit a message ────────────────────────────────────────────────────────
    socket.on(
      "message:edit",
      async ({
        messageId,
        senderId,
        content,
        conversationId,
      }: {
        messageId: string;
        senderId: string;
        content: string;
        conversationId: string;
      }) => {
        try {
          const updated = await ChatService.editMessage(
            messageId,
            senderId,
            content,
          );
          if (updated) io.to(conversationId).emit("message:edited", updated);
        } catch (err) {
          console.error("[Socket] message:edit error:", err);
          socket.emit("message:error", { error: "Failed to edit message" });
        }
      },
    );

    // ── Delete a message ──────────────────────────────────────────────────────
    socket.on(
      "message:delete",
      async ({
        messageId,
        userId,
        deleteFor,
        conversationId,
      }: {
        messageId: string;
        userId: string;
        deleteFor: "me" | "everyone";
        conversationId: string;
      }) => {
        try {
          await ChatService.deleteMessage(messageId, userId, deleteFor);
          if (deleteFor === "everyone") {
            io.to(conversationId).emit("message:deleted", {
              messageId,
              deleteFor,
            });
          } else {
            socket.emit("message:deleted", { messageId, deleteFor });
          }
        } catch (err) {
          console.error("[Socket] message:delete error:", err);
          socket.emit("message:error", { error: "Failed to delete message" });
        }
      },
    );

    // ── Typing indicators ─────────────────────────────────────────────────────
    socket.on(
      "typing:start",
      ({
        conversationId,
        userId,
      }: {
        conversationId: string;
        userId: string;
      }) => {
        socket.to(conversationId).emit("typing:start", { userId });
      },
    );

    socket.on(
      "typing:stop",
      ({
        conversationId,
        userId,
      }: {
        conversationId: string;
        userId: string;
      }) => {
        socket.to(conversationId).emit("typing:stop", { userId });
      },
    );

    // ── Mark messages as read ─────────────────────────────────────────────────
    socket.on(
      "messages:read",
      async ({
        conversationId,
        userId,
      }: {
        conversationId: string;
        userId: string;
      }) => {
        try {
          await ChatService.markAsRead(conversationId, userId);
          io.to(conversationId).emit("messages:read", {
            conversationId,
            userId,
          });
        } catch (err) {
          console.error("[Socket] messages:read error:", err);
        }
      },
    );

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const userId = socket.data.userId;
      if (userId) {
        onlineUsers.delete(userId);
        io.emit("users:online", Array.from(onlineUsers.keys()));
        console.log(`[Socket] disconnected userId=${userId}`);
      }
    });
  });

  return io;
};

export { onlineUsers };
