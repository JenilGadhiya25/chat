import express from "express";
import Status from "../models/Status.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../utils/upload.js";

const router = express.Router();

// GET /api/status — all active statuses from other users + own
router.get("/", protect, async (req, res) => {
  try {
    const statuses = await Status.find({ expiresAt: { $gt: new Date() } })
      .populate("user", "username avatar")
      .populate("viewers", "username avatar")
      .sort({ createdAt: -1 });

    // Group by user
    const map = new Map();
    for (const s of statuses) {
      const uid = s.user._id.toString();
      if (!map.has(uid)) map.set(uid, { user: s.user, items: [] });
      map.get(uid).items.push(s);
    }

    res.json(Array.from(map.values()));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/status — create a new status
router.post(
  "/",
  protect,
  upload.single("media"),
  async (req, res) => {
    try {
      const { text, textBg } = req.body;
      if (!text && !req.file) {
        return res.status(400).json({ message: "Text or media required" });
      }

      const statusData = { user: req.user._id };
      if (text) { statusData.text = text; statusData.textBg = textBg || "#00a884"; }
      if (req.file) {
        const isVideo = req.file.mimetype.startsWith("video/");
        statusData.media = {
          url: `/uploads/${req.file.filename}`,
          type: isVideo ? "video" : "image",
        };
      }

      const status = await Status.create(statusData);
      const populated = await status.populate("user", "username avatar");
      res.status(201).json(populated);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// POST /api/status/:id/view — mark as viewed
router.post("/:id/view", protect, async (req, res) => {
  try {
    const status = await Status.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { viewers: req.user._id } },
      { new: true }
    );
    if (!status) return res.status(404).json({ message: "Status not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/status/:id
router.delete("/:id", protect, async (req, res) => {
  try {
    const status = await Status.findOne({ _id: req.params.id, user: req.user._id });
    if (!status) return res.status(404).json({ message: "Not found" });
    await status.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
