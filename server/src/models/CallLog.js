import mongoose from "mongoose";

const callLogSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    callType: { type: String, enum: ["audio", "video"], default: "audio" },
    status: { type: String, enum: ["completed", "missed", "declined", "cancelled"], default: "completed" },
    durationSec: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

callLogSchema.index({ participants: 1, startedAt: -1 });

export default mongoose.model("CallLog", callLogSchema);
