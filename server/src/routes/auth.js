import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const username = req.body.username?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const { password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(409).json({ message: "User already exists" });

    const user = await User.create({ username, email, password });
    res.status(201).json({ token: signToken(user._id), user });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "User already exists" });
    }
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: "Invalid credentials" });

    res.json({ token: signToken(user._id), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get("/me", protect, (req, res) => res.json(req.user));

// GET /api/auth/ping — health check / wake-up for Render free tier
router.get("/ping", (_req, res) => res.json({ ok: true, ts: Date.now() }));

export default router;
