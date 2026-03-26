import mongoose from "mongoose";

const statusSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Either text or media (or both)
    text: { type: String, default: "" },
    textBg: { type: String, default: "#00a884" }, // background colour for text statuses
    media: {
      url: String,
      type: { type: String, enum: ["image", "video"] },
    },
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  },
  { timestamps: true }
);

// Auto-delete after 24 h
statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Status", statusSchema);
