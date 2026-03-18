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
import { initSocket } from "./socket/socket.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const httpServer = createServer(app);

const configuredClientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const allowedOrigins = new Set([
  configuredClientUrl,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // non-browser clients (curl/postman/server-to-server)
  if (allowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    const isLocalHost =
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      /^http:$/.test(url.protocol);
    return isLocalHost;
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
app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);

app.get("/", (_req, res) => res.json({ status: "Chat API running" }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

// Socket.io
initSocket(io);

// Connect to DB then start server
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatapp";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected:", MONGO_URI.split("@").pop() || MONGO_URI);
    httpServer.listen(process.env.PORT || 5000, () =>
      console.log(`🚀 Server running on http://localhost:${process.env.PORT || 5000}`)
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    console.error(
      "\n👉 Fix: Update MONGO_URI in server/.env\n" +
      "   Local:  mongodb://127.0.0.1:27017/chatapp\n" +
      "   Atlas:  mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/chatapp\n"
    );
    process.exit(1);
  });
