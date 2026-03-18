import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "" },
    media: {
      url: { type: String, default: "" },
      type: { type: String, enum: ["image", "video", "file", ""], default: "" },
      name: { type: String, default: "" },
    },
    status: { type: String, enum: ["sent", "delivered", "seen"], default: "sent" },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isEdited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
