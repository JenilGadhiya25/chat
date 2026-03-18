import { io } from "socket.io-client";

const SERVER_URL = (import.meta.env.VITE_SERVER_URL || "http://localhost:5000").replace(/\/$/, "");

let socket = null;

export const connectSocket = (userId) => {
  // If already connected with same user, reuse
  if (socket?.connected) return socket;

  // Disconnect stale socket before creating new one
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SERVER_URL, {
    query: { userId },
    withCredentials: true,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => console.log("Socket connected:", socket.id));
  socket.on("connect_error", (err) => console.error("Socket error:", err.message));

  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};

export const getSocket = () => socket;
