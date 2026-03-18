import express from "express";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../utils/upload.js";
import { getIO, getSocketId } from "../socket/socket.js";

const router = express.Router();

// GET /api/messages/conversations
router.get("/conversations", protect, async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate("participants", "-password")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages/conversations - start or get conversation
router.post("/conversations", protect, async (req, res) => {
  try {
    const { userId, isGroup, groupName, participants } = req.body;

    if (isGroup) {
      const conv = await Conversation.create({
        participants: [req.user._id, ...participants],
        isGroup: true,
        groupName,
        admin: req.user._id,
      });
      await conv.populate("participants", "-password");
      return res.status(201).json(conv);
    }

    // One-to-one: find existing or create
    let conv = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, userId], $size: 2 },
    })
      .populate("participants", "-password")
      .populate("lastMessage");

    if (!conv) {
      conv = await Conversation.create({ participants: [req.user._id, userId] });
      await conv.populate("participants", "-password");
    }
    res.json(conv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/messages/:conversationId
router.get("/:conversationId", protect, async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.conversationId,
      deletedFor: { $ne: req.user._id },
    })
      .populate("sender", "username avatar")
      .sort({ createdAt: 1 });

    // Mark messages as seen
    await Message.updateMany(
      {
        conversationId: req.params.conversationId,
        sender: { $ne: req.user._id },
        status: { $ne: "seen" },
      },
      { status: "seen" }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages/:conversationId - send message
router.post("/:conversationId", protect, upload.single("media"), async (req, res) => {
  try {
    const { text } = req.body;
    const mediaFile = req.file;

    if (!text && !mediaFile)
      return res.status(400).json({ message: "Message cannot be empty" });

    const mediaData =
      mediaFile
        ? {
            url: `/uploads/${mediaFile.filename}`,
            type: mediaFile.mimetype.split("/")[0],
            name: mediaFile.originalname,
          }
        : {};

    const message = await Message.create({
      conversationId: req.params.conversationId,
      sender: req.user._id,
      text: text || "",
      media: mediaData,
    });

    await message.populate("sender", "username avatar");

    // Update conversation lastMessage
    await Conversation.findByIdAndUpdate(req.params.conversationId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    // Emit to all participants via socket
    const io = getIO();
    if (io) {
      const conversation = await Conversation.findById(req.params.conversationId);
      conversation.participants.forEach((participantId) => {
        if (participantId.toString() === req.user._id.toString()) return;
        const socketId = getSocketId(participantId.toString());
        if (socketId) io.to(socketId).emit("newMessage", message);
      });
    }

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/messages/:messageId
router.delete("/:messageId", protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.sender.toString() === req.user._id.toString()) {
      await message.deleteOne();
    } else {
      message.deletedFor.push(req.user._id);
      await message.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/messages/:messageId - edit message
router.put("/:messageId", protect, async (req, res) => {
  try {
    const { text } = req.body;
    const message = await Message.findOne({
      _id: req.params.messageId,
      sender: req.user._id,
    });
    if (!message) return res.status(404).json({ message: "Not found or unauthorized" });

    message.text = text;
    message.isEdited = true;
    await message.save();
    await message.populate("sender", "username avatar");

    // Notify participants
    const io = getIO();
    if (io) {
      const conversation = await Conversation.findById(message.conversationId);
      conversation.participants.forEach((participantId) => {
        if (participantId.toString() === req.user._id.toString()) return;
        const socketId = getSocketId(participantId.toString());
        if (socketId) io.to(socketId).emit("messageEdited", message);
      });
    }

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
