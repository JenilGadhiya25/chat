import express from "express";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import CallLog from "../models/CallLog.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../utils/upload.js";
import { getIO, emitToUser } from "../socket/socket.js";
import { storeMediaFile } from "../utils/mediaStore.js";

const router = express.Router();

const populateConversation = async (target) => {
  if (!target) return target;

  // Query path
  if (typeof target.exec === "function") {
    return target
      .populate("participants", "-password")
      .populate("admins", "username avatar")
      .populate("createdBy", "username avatar")
      .populate("lastMessage");
  }

  // Document path
  await target.populate("participants", "-password");
  await target.populate("admins", "username avatar");
  await target.populate("createdBy", "username avatar");
  await target.populate("lastMessage");
  return target;
};

const isAdminUser = (conv, userId) => {
  const admins = conv.admins?.length ? conv.admins : conv.admin ? [conv.admin] : [];
  return admins.some((id) => id.toString() === userId.toString());
};

// GET /api/messages/calls
router.get("/calls", protect, async (req, res) => {
  try {
    const logs = await CallLog.find({ participants: req.user._id })
      .sort({ startedAt: -1 })
      .limit(100)
      .populate("initiatedBy", "username avatar")
      .populate({
        path: "conversationId",
        populate: [
          { path: "participants", select: "username avatar isOnline lastSeen" },
          { path: "admins", select: "username avatar" },
          { path: "createdBy", select: "username avatar" },
        ],
      });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/messages/conversations
router.get("/conversations", protect, async (req, res) => {
  try {
    const query = Conversation.find({ participants: req.user._id }).sort({ updatedAt: -1 });
    const conversations = await populateConversation(query);
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages/conversations - start or get conversation
router.post("/conversations", protect, upload.single("groupAvatar"), async (req, res) => {
  try {
    const { userId, isGroup, groupName, groupDescription, participants } = req.body;

    if (isGroup) {
      const memberIds = Array.isArray(participants) ? participants : JSON.parse(participants || "[]");
      const uniqueMembers = [...new Set(memberIds.map((id) => id.toString()).filter(Boolean))];
      const uniqueParticipants = [...new Set([req.user._id.toString(), ...uniqueMembers])];
      const convData = {
        participants: uniqueParticipants,
        isGroup: true,
        groupName,
        groupDescription: groupDescription || "",
        createdBy: req.user._id,
        admins: [req.user._id],
        admin: req.user._id,
      };
      if (req.file) convData.groupAvatar = await storeMediaFile(req.file, { folder: "chatapp/groups" });
      const conv = await Conversation.create(convData);
      await populateConversation(conv);
      return res.status(201).json(conv);
    }

    // One-to-one: find existing or create
    let conv = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, userId], $size: 2 },
    });
    conv = conv ? await populateConversation(conv) : null;

    if (!conv) {
      conv = await Conversation.create({ participants: [req.user._id, userId] });
      await populateConversation(conv);
    }
    res.json(conv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages/conversations/:id/calls - add call log
router.post("/conversations/:id/calls", protect, async (req, res) => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, participants: req.user._id });
    if (!conv) return res.status(404).json({ message: "Conversation not found" });

    const { callType, status, durationSec, startedAt, endedAt } = req.body;
    const log = await CallLog.create({
      conversationId: conv._id,
      participants: conv.participants,
      initiatedBy: req.user._id,
      callType: callType === "video" ? "video" : "audio",
      status: ["completed", "missed", "declined", "cancelled"].includes(status) ? status : "completed",
      durationSec: Number.isFinite(Number(durationSec)) ? Math.max(0, Number(durationSec)) : 0,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      endedAt: endedAt ? new Date(endedAt) : new Date(),
    });

    await log.populate("initiatedBy", "username avatar");
    await log.populate({
      path: "conversationId",
      populate: [
        { path: "participants", select: "username avatar isOnline lastSeen" },
        { path: "admins", select: "username avatar" },
        { path: "createdBy", select: "username avatar" },
      ],
    });

    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/messages/conversations/:id/group-profile - update group avatar/details (admin only)
router.put("/conversations/:id/group-profile", protect, upload.single("groupAvatar"), async (req, res) => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, isGroup: true, participants: req.user._id });
    if (!conv) return res.status(404).json({ message: "Group not found" });
    if (!isAdminUser(conv, req.user._id)) return res.status(403).json({ message: "Only admins can update group profile" });

    const updates = {};
    const groupName = req.body.groupName?.trim();
    const groupDescription = req.body.groupDescription?.trim();
    if (groupName) updates.groupName = groupName;
    if (groupDescription !== undefined) updates.groupDescription = groupDescription;
    if (req.file) updates.groupAvatar = await storeMediaFile(req.file, { folder: "chatapp/groups" });

    let updated = await Conversation.findByIdAndUpdate(conv._id, updates, { new: true });
    updated = updated ? await populateConversation(updated) : null;
    if (!updated) return res.status(404).json({ message: "Group not found" });
    res.json(updated);
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
            url: await storeMediaFile(mediaFile, { folder: "chatapp/messages" }),
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
        emitToUser(io, participantId.toString(), "newMessage", message);
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
        emitToUser(io, participantId.toString(), "messageEdited", message);
      });
    }

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages/:messageId/reaction - add/update/remove own reaction
router.post("/:messageId/reaction", protect, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: "Emoji is required" });

    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation || !conversation.participants.some((p) => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const idx = message.reactions.findIndex((r) => r.user.toString() === req.user._id.toString());
    if (idx === -1) {
      message.reactions.push({ user: req.user._id, emoji });
    } else if (message.reactions[idx].emoji === emoji) {
      // Toggle off if same emoji selected again
      message.reactions.splice(idx, 1);
    } else {
      message.reactions[idx].emoji = emoji;
    }

    await message.save();
    await message.populate("sender", "username avatar");

    const io = getIO();
    if (io) {
      conversation.participants.forEach((participantId) => {
        emitToUser(io, participantId.toString(), "messageReaction", message);
      });
    }

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages/conversations/:id/pin
router.post("/conversations/:id/pin", protect, async (req, res) => {
  try {
    let conv = await Conversation.findOneAndUpdate(
      { _id: req.params.id, participants: req.user._id },
      { $addToSet: { pinnedBy: req.user._id } },
      { new: true }
    );
    conv = conv ? await populateConversation(conv) : null;
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    res.json(conv);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/messages/conversations/:id/unpin
router.post("/conversations/:id/unpin", protect, async (req, res) => {
  try {
    let conv = await Conversation.findOneAndUpdate(
      { _id: req.params.id, participants: req.user._id },
      { $pull: { pinnedBy: req.user._id } },
      { new: true }
    );
    conv = conv ? await populateConversation(conv) : null;
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    res.json(conv);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/messages/conversations/:id/archive
router.post("/conversations/:id/archive", protect, async (req, res) => {
  try {
    let conv = await Conversation.findOneAndUpdate(
      { _id: req.params.id, participants: req.user._id },
      { $addToSet: { archivedBy: req.user._id } },
      { new: true }
    );
    conv = conv ? await populateConversation(conv) : null;
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    res.json(conv);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/messages/conversations/:id/unarchive
router.post("/conversations/:id/unarchive", protect, async (req, res) => {
  try {
    let conv = await Conversation.findOneAndUpdate(
      { _id: req.params.id, participants: req.user._id },
      { $pull: { archivedBy: req.user._id } },
      { new: true }
    );
    conv = conv ? await populateConversation(conv) : null;
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    res.json(conv);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/messages/conversations/:id/admins - promote a participant to admin
router.post("/conversations/:id/admins", protect, async (req, res) => {
  try {
    const { userId } = req.body;
    const conv = await Conversation.findOne({ _id: req.params.id, isGroup: true, participants: req.user._id });
    if (!conv) return res.status(404).json({ message: "Group not found" });
    if (!isAdminUser(conv, req.user._id)) return res.status(403).json({ message: "Only admins can change roles" });
    if (!conv.participants.some((p) => p.toString() === userId)) {
      return res.status(400).json({ message: "User is not a participant" });
    }

    conv.admins = conv.admins?.length ? conv.admins : conv.admin ? [conv.admin] : [];
    conv.admins = [...new Set([...conv.admins.map((a) => a.toString()), userId])];
    conv.admin = conv.admins[0] || conv.admin;
    await conv.save();
    await populateConversation(conv);
    res.json(conv);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/messages/conversations/:id/admins/:userId - demote admin
router.delete("/conversations/:id/admins/:userId", protect, async (req, res) => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, isGroup: true, participants: req.user._id });
    if (!conv) return res.status(404).json({ message: "Group not found" });
    if (!isAdminUser(conv, req.user._id)) return res.status(403).json({ message: "Only admins can change roles" });

    const targetId = req.params.userId;
    const admins = conv.admins?.length ? conv.admins.map((a) => a.toString()) : conv.admin ? [conv.admin.toString()] : [];
    if (!admins.includes(targetId)) return res.status(400).json({ message: "User is not an admin" });

    const nextAdmins = admins.filter((id) => id !== targetId);
    if (nextAdmins.length === 0) {
      return res.status(400).json({ message: "Group must have at least one admin" });
    }

    conv.admins = nextAdmins;
    conv.admin = nextAdmins[0];
    await conv.save();
    await populateConversation(conv);
    res.json(conv);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/messages/conversations/:id/participants/:userId - remove participant (admin-only)
router.delete("/conversations/:id/participants/:userId", protect, async (req, res) => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, isGroup: true, participants: req.user._id });
    if (!conv) return res.status(404).json({ message: "Group not found" });
    if (!isAdminUser(conv, req.user._id)) return res.status(403).json({ message: "Only admins can remove participants" });

    const targetId = req.params.userId;
    if (targetId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Use leave/delete action for yourself" });
    }
    if (!conv.participants.some((p) => p.toString() === targetId)) {
      return res.status(400).json({ message: "User is not a participant" });
    }

    conv.participants = conv.participants.filter((id) => id.toString() !== targetId);
    const admins = conv.admins?.length ? conv.admins.map((a) => a.toString()) : conv.admin ? [conv.admin.toString()] : [];
    const nextAdmins = admins.filter((id) => id !== targetId);
    conv.admins = nextAdmins;

    // Ensure at least one admin remains while group exists
    if (conv.participants.length > 0 && conv.admins.length === 0) {
      conv.admins = [conv.participants[0]];
    }
    conv.admin = conv.admins[0] || null;

    await conv.save();
    await populateConversation(conv);
    res.json(conv);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/messages/conversations/:id — delete all messages for this user & remove from list
router.delete("/conversations/:id", protect, async (req, res) => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, participants: req.user._id });
    if (!conv) return res.status(404).json({ message: "Conversation not found" });

    // Mark all messages in this conversation as deleted for this user
    await Message.updateMany(
      { conversationId: req.params.id },
      { $addToSet: { deletedFor: req.user._id } }
    );

    // Remove user from participants so it disappears from their list
    conv.participants = conv.participants.filter(
      (p) => p.toString() !== req.user._id.toString()
    );
    const admins = conv.admins?.length ? conv.admins.map((a) => a.toString()) : conv.admin ? [conv.admin.toString()] : [];
    const nextAdmins = admins.filter((id) => id !== req.user._id.toString());
    conv.admins = nextAdmins;
    if (conv.participants.length > 0 && conv.admins.length === 0) {
      conv.admins = [conv.participants[0]];
    }
    conv.admin = conv.admins[0] || null;

    // If no participants left, delete the conversation entirely
    if (conv.participants.length === 0) {
      await conv.deleteOne();
    } else {
      await conv.save();
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/messages/block/:userId — block a user
router.post("/block/:userId", protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: req.params.userId },
    });
    res.json({ success: true, blocked: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/messages/unblock/:userId — unblock a user
router.post("/unblock/:userId", protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: req.params.userId },
    });
    res.json({ success: true, blocked: false });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;
