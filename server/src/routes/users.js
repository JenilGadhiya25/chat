import express from "express";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../utils/upload.js";

const router = express.Router();

// GET /api/users - search users
router.get("/", protect, async (req, res) => {
  try {
    const { search } = req.query;
    const filter = search
      ? { username: { $regex: search, $options: "i" }, _id: { $ne: req.user._id } }
      : { _id: { $ne: req.user._id } };

    let query = User.find(filter).select("-password").sort({ username: 1 });
    if (search) query = query.limit(20);
    const users = await query;
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/avatar
router.put("/avatar", protect, async (req, res) => {
  try {
    const { avatar } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { avatar }, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/profile
router.put(
  "/profile",
  protect,
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "background", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const updates = {};
      const username = req.body.username?.trim();
      const email = req.body.email?.trim().toLowerCase();
      const avatarPreset = req.body.avatarPreset?.trim();
      const backgroundPreset = req.body.backgroundPreset?.trim();

      if (username && username !== req.user.username) {
        const exists = await User.findOne({ username, _id: { $ne: req.user._id } });
        if (exists) return res.status(409).json({ message: "Username already taken" });
        updates.username = username;
      }

      if (email && email !== req.user.email) {
        const exists = await User.findOne({ email, _id: { $ne: req.user._id } });
        if (exists) return res.status(409).json({ message: "Email already in use" });
        updates.email = email;
      }

      const avatarColor = req.body.avatarColor?.trim();
      const backgroundColor = req.body.backgroundColor?.trim();

      const avatarFile = req.files?.avatar?.[0];
      if (avatarFile) {
        if (!avatarFile.mimetype.startsWith("image/")) {
          return res.status(400).json({ message: "Avatar must be an image" });
        }
        updates.avatar = `/uploads/${avatarFile.filename}`;
      } else if (avatarPreset) {
        if (!avatarPreset.startsWith("/presets/avatars/")) {
          return res.status(400).json({ message: "Invalid avatar preset" });
        }
        updates.avatar = avatarPreset;
      } else if (avatarColor) {
        // Store colour string directly (e.g. "#00a884" or gradient)
        updates.avatar = `color:${avatarColor}`;
      }

      const backgroundFile = req.files?.background?.[0];
      if (backgroundFile) {
        if (!backgroundFile.mimetype.startsWith("image/")) {
          return res.status(400).json({ message: "Background must be an image" });
        }
        updates.chatBackground = `/uploads/${backgroundFile.filename}`;
      } else if (backgroundPreset) {
        if (!backgroundPreset.startsWith("/presets/backgrounds/")) {
          return res.status(400).json({ message: "Invalid background preset" });
        }
        updates.chatBackground = backgroundPreset;
      } else if (backgroundColor) {
        updates.chatBackground = `color:${backgroundColor}`;
      }

      if (req.body.clearBackground === "true") {
        updates.chatBackground = "";
      }

      const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true,
      }).select("-password");

      res.json(user);
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({ message: "Duplicate value already exists" });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;
