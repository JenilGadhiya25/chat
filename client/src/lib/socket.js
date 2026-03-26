import { io } from "socket.io-client";

const resolveServerUrl = () => {
  const envUrl = (import.meta.env.VITE_SERVER_URL || "").trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  if (import.meta.env.DEV) return "http://localhost:8000";

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
};

const SERVER_URL = resolveServerUrl();

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
    transports: ["websocket", "polling"],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
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
