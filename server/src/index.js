import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import messageRoutes from "./routes/messages.js";
import userRoutes from "./routes/users.js";
import statusRoutes from "./routes/status.js";
import aiRoutes from "./routes/ai.js";
import { initSocket } from "./socket/socket.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const httpServer = createServer(app);

const configuredClientUrls = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URLS,
]
  .filter(Boolean)
  .flatMap((v) => String(v).split(","))
  .map((v) => v.trim())
  .filter(Boolean);
const LAN_IP = process.env.LAN_IP || "192.168.29.250";

const allowedOrigins = new Set([
  ...configuredClientUrls,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  `http://${LAN_IP}:5173`,
]);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    const isNetlify = /^https:$/.test(url.protocol) && url.hostname.endsWith(".netlify.app");
    const isLocal =
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === LAN_IP) &&
      /^http:$/.test(url.protocol);
    return isLocal || isNetlify;
  } catch {
    return false;
  }
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
};

const io = new Server(httpServer, {
  cors: corsOptions,
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded media files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/ai", aiRoutes);

app.get("/", (_req, res) => res.json({ status: "Chat API running" }));
app.get("/ping", (_req, res) => res.json({ ok: true }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

// Socket.io
initSocket(io);

// Connect to DB then start server
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatapp";
const PORT = process.env.PORT || 8000;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected:", MONGO_URI.split("@").pop() || MONGO_URI);
    httpServer.listen(PORT, "0.0.0.0", () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    // Still bind the port so Render doesn't kill the process
    httpServer.listen(PORT, "0.0.0.0", () =>
      console.log(`⚠️  Server running WITHOUT database on port ${PORT}`)
    );
  });
