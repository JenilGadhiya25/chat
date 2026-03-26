import User from "../models/User.js";
import jwt from "jsonwebtoken";

// Map userId -> socketId
const onlineUsers = new Map();

// Map qrToken -> { socketId, createdAt }  (for QR login)
const qrSessions = new Map();

let _io = null;

export const getIO = () => _io;
export const getSocketId = (userId) => onlineUsers.get(userId);

export const initSocket = (io) => {
  _io = io;

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (userId && userId !== "undefined") {
      onlineUsers.set(userId, socket.id);
      User.findByIdAndUpdate(userId, { isOnline: true }).exec();
      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    }

    // ── QR Login ──────────────────────────────────────────────
    // Browser requests a QR token to display
    socket.on("qr:request", () => {
      const token = `qr_${socket.id}_${Date.now()}`;
      qrSessions.set(token, { socketId: socket.id, createdAt: Date.now() });
      socket.emit("qr:token", token);

      // Expire after 60 s
      setTimeout(() => qrSessions.delete(token), 60_000);
    });

    // Phone scans QR — first notify desktop that scan happened
    socket.on("qr:scan", async ({ qrToken, userId: scannerId }) => {
      const session = qrSessions.get(qrToken);
      if (!session) return socket.emit("qr:error", "QR expired or invalid");

      try {
        const user = await User.findById(scannerId).select("-password");
        if (!user) return socket.emit("qr:error", "User not found");

        // Tell desktop "phone has scanned, waiting for confirm"
        io.to(session.socketId).emit("qr:scanned");

        const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        // Authenticate the desktop tab
        io.to(session.socketId).emit("qr:authenticated", { token: jwtToken, user });

        // Tell the phone confirm page it worked
        socket.emit("qr:confirmed");

        qrSessions.delete(qrToken);
      } catch (err) {
        socket.emit("qr:error", err.message);
      }
    });
    // ──────────────────────────────────────────────────────────

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

    // WebRTC call signaling
    socket.on("call:offer", ({ toUserId, payload }) => {
      const targetSocket = onlineUsers.get(toUserId);
      if (targetSocket) {
        io.to(targetSocket).emit("call:offer", { fromUserId: userId, ...payload });
      }
    });

    socket.on("call:answer", ({ toUserId, payload }) => {
      const targetSocket = onlineUsers.get(toUserId);
      if (targetSocket) {
        io.to(targetSocket).emit("call:answer", { fromUserId: userId, ...payload });
      }
    });

    socket.on("call:ice", ({ toUserId, payload }) => {
      const targetSocket = onlineUsers.get(toUserId);
      if (targetSocket) {
        io.to(targetSocket).emit("call:ice", { fromUserId: userId, ...payload });
      }
    });

    socket.on("call:end", ({ toUserId, payload }) => {
      const targetSocket = onlineUsers.get(toUserId);
      if (targetSocket) {
        io.to(targetSocket).emit("call:end", { fromUserId: userId, ...payload });
      }
    });

    socket.on("disconnect", () => {
      if (userId && userId !== "undefined") {
        onlineUsers.delete(userId);
        User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() }).exec();
        io.emit("onlineUsers", Array.from(onlineUsers.keys()));
      }
    });
  });
};
