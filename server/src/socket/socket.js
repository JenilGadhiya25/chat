import User from "../models/User.js";

// Map userId -> socketId
const onlineUsers = new Map();

// io instance stored here to avoid circular imports
let _io = null;

export const getIO = () => _io;
export const getSocketId = (userId) => onlineUsers.get(userId);

export const initSocket = (io) => {
  _io = io;

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (userId) {
      onlineUsers.set(userId, socket.id);
      User.findByIdAndUpdate(userId, { isOnline: true }).exec();
      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    }

    // Join a conversation room
    socket.on("joinConversation", (conversationId) => {
      socket.join(conversationId);
    });

    // Typing indicator
    socket.on("typing", ({ conversationId, userId: typingUserId }) => {
      socket.to(conversationId).emit("typing", { conversationId, userId: typingUserId });
    });

    socket.on("stopTyping", ({ conversationId, userId: typingUserId }) => {
      socket.to(conversationId).emit("stopTyping", { conversationId, userId: typingUserId });
    });

    // Message seen
    socket.on("messageSeen", ({ conversationId, senderId }) => {
      const senderSocket = onlineUsers.get(senderId);
      if (senderSocket) {
        io.to(senderSocket).emit("messageSeen", { conversationId });
      }
    });

    socket.on("disconnect", () => {
      if (userId) {
        onlineUsers.delete(userId);
        User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() }).exec();
        io.emit("onlineUsers", Array.from(onlineUsers.keys()));
      }
    });
  });
};
