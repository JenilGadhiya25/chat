import User from "../models/User.js";
import jwt from "jsonwebtoken";
import Conversation from "../models/Conversation.js";

// Map userId -> Set<socketId>
const onlineUsers = new Map();

// Map qrToken -> { socketId, createdAt }  (for QR login)
const qrSessions = new Map();

let _io = null;

export const getIO = () => _io;
export const getSocketId = (userId) => {
  const sockets = onlineUsers.get(userId);
  if (!sockets || sockets.size === 0) return undefined;
  return [...sockets][0];
};

export const getSocketIds = (userId) => {
  const sockets = onlineUsers.get(userId);
  return sockets ? [...sockets] : [];
};

export const emitToUser = (io, userId, event, payload) => {
  const targets = getSocketIds(userId);
  if (!targets.length) return false;
  targets.forEach((sid) => io.to(sid).emit(event, payload));
  return true;
};

export const initSocket = (io) => {
  _io = io;

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (userId && userId !== "undefined") {
      const existing = onlineUsers.get(userId) || new Set();
      existing.add(socket.id);
      onlineUsers.set(userId, existing);
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
      const delivered = emitToUser(io, toUserId, "call:offer", { fromUserId: userId, ...payload });
      if (!delivered && userId && userId !== "undefined") {
        emitToUser(io, userId, "call:end", {
          fromUserId: toUserId,
          reason: "unavailable",
          conversationId: payload?.conversationId,
        });
      }
    });

    socket.on("call:answer", ({ toUserId, payload }) => {
      emitToUser(io, toUserId, "call:answer", { fromUserId: userId, ...payload });
    });

    socket.on("call:ice", ({ toUserId, payload }) => {
      emitToUser(io, toUserId, "call:ice", { fromUserId: userId, ...payload });
    });

    socket.on("call:end", ({ toUserId, payload }) => {
      emitToUser(io, toUserId, "call:end", { fromUserId: userId, ...payload });
    });

    // Group-call mesh helper:
    // when one participant joins a group call, notify the rest so they can create peer offers to this participant.
    socket.on("call:group:join", async ({ conversationId, callType }) => {
      try {
        if (!userId || !conversationId) return;
        const conv = await Conversation.findById(conversationId).select("participants");
        if (!conv) return;
        const participantIds = (conv.participants || []).map((id) => id.toString());
        if (!participantIds.includes(userId.toString())) return;

        const joinedUser = await User.findById(userId).select("username avatar");
        participantIds
          .filter((pid) => pid !== userId.toString())
          .forEach((pid) => {
            emitToUser(io, pid, "call:group:participant-joined", {
              conversationId,
              callType: callType || "audio",
              participantId: userId,
              participantName: joinedUser?.username || "Unknown",
              participantAvatar: joinedUser?.avatar || "",
            });
          });
      } catch {
        // no-op: group call should continue even if notification fails for some users
      }
    });

    socket.on("disconnect", () => {
      if (userId && userId !== "undefined") {
        const sockets = onlineUsers.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            onlineUsers.delete(userId);
            User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() }).exec();
          } else {
            onlineUsers.set(userId, sockets);
          }
        }
        io.emit("onlineUsers", Array.from(onlineUsers.keys()));
      }
    });
  });
};
