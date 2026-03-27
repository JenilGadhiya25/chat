import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
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

const readRenderSecret = (name) => {
  try {
    const secretPath = `/etc/secrets/${name}`;
    if (!fs.existsSync(secretPath)) return "";
    return fs.readFileSync(secretPath, "utf8").trim();
  } catch {
    return "";
  }
};

const getConfigValue = (name) => {
  const envVal = (process.env[name] || "").trim().replace(/^['"]|['"]$/g, "");
  if (envVal) return envVal;
  return readRenderSecret(name);
};

// Support Render Secret Files fallback when env vars are not directly injected.
for (const key of ["MONGO_URI", "MONGODB_URI", "JWT_SECRET", "CLIENT_URL", "CLIENT_URLS", "PORT", "MONGO_RETRY_MS", "MONGO_FAMILY"]) {
  if (!process.env[key]) {
    const fileVal = getConfigValue(key);
    if (fileVal) process.env[key] = fileVal;
  }
}

const app = express();
const httpServer = createServer(app);
let serverStarted = false;
let lastMongoError = null;
let lastMongoAttemptAt = null;

// Avoid mongoose buffering queries when DB is unavailable (prevents 10s buffering timeout errors)
mongoose.set("bufferCommands", false);

const configuredClientUrls = [
  getConfigValue("CLIENT_URL"),
  getConfigValue("CLIENT_URLS"),
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

// Health route (useful for deployment diagnostics)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    mongoReadyState: mongoose.connection.readyState,
    mongoConnected: mongoose.connection.readyState === 1,
    lastMongoError,
    lastMongoAttemptAt,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    mongoReadyState: mongoose.connection.readyState,
    mongoConnected: mongoose.connection.readyState === 1,
    lastMongoError,
    lastMongoAttemptAt,
  });
});

// Block API calls while MongoDB is not ready
app.use("/api", (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message:
        "Database is not connected in this environment. Check MONGO_URI, MongoDB Atlas IP allowlist, and deployment env vars.",
    });
  }
  return next();
});

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
const MONGO_URI =
  getConfigValue("MONGO_URI") ||
  getConfigValue("MONGODB_URI") ||
  "mongodb://127.0.0.1:27017/chatapp";
const PORT = getConfigValue("PORT") || 8000;
const MONGO_RETRY_MS = Number(getConfigValue("MONGO_RETRY_MS") || 10000);
const MONGO_FAMILY = Number(getConfigValue("MONGO_FAMILY") || 4);

const startHttpServer = () => {
  if (serverStarted) return;
  serverStarted = true;
  httpServer.listen(PORT, "0.0.0.0", () =>
    console.log(`🚀 Server running on port ${PORT}`)
  );
};

const connectMongoWithRetry = async () => {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;
  try {
    lastMongoAttemptAt = new Date().toISOString();
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: MONGO_FAMILY,
    });
    lastMongoError = null;
    console.log("✅ MongoDB connected:", MONGO_URI.split("@").pop() || MONGO_URI);
  } catch (err) {
    lastMongoError = err?.message || "Unknown Mongo connection error";
    console.error("❌ MongoDB connection failed:", lastMongoError);
    console.log(`↻ Retrying MongoDB connection in ${MONGO_RETRY_MS / 1000}s...`);
    setTimeout(connectMongoWithRetry, MONGO_RETRY_MS);
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected. Retrying...");
  setTimeout(connectMongoWithRetry, 2000);
});

mongoose.connection.on("error", (err) => {
  lastMongoError = err?.message || "Unknown Mongo runtime error";
  console.error("❌ MongoDB runtime error:", lastMongoError);
});

startHttpServer();
connectMongoWithRetry();
