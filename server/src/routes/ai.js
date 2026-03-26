import express from "express";
import { protect } from "../middleware/auth.js";

const router = express.Router();

const getAiConfig = () => ({
  apiKey: process.env.OPENAI_API_KEY || "",
  chatModel: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
});

const requireKey = (res, apiKey) => {
  if (apiKey) return true;
  res.status(500).json({ message: "AI is not configured. Add OPENAI_API_KEY to server/.env" });
  return false;
};

router.get("/status", protect, async (_req, res) => {
  const { apiKey, chatModel, imageModel } = getAiConfig();
  res.json({
    configured: Boolean(apiKey),
    chatModel,
    imageModel,
  });
});

router.post("/chat", protect, async (req, res) => {
  try {
    const { apiKey, chatModel } = getAiConfig();
    if (!requireKey(res, apiKey)) return;
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const prompt = req.body?.prompt?.toString()?.trim();

    const finalMessages = messages.length > 0
      ? messages
      : [{ role: "user", content: prompt || "Hello" }];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: chatModel,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant inside a WhatsApp-like chat app. Give clear, concise, accurate responses.",
          },
          ...finalMessages.slice(-20),
        ],
        temperature: 0.6,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ message: data?.error?.message || "AI chat failed" });
    }

    const text = data?.choices?.[0]?.message?.content || "Sorry, I could not generate a response.";
    return res.json({ text });
  } catch (err) {
    return res.status(500).json({ message: err.message || "AI chat failed" });
  }
});

router.post("/image", protect, async (req, res) => {
  try {
    const { apiKey, imageModel } = getAiConfig();
    if (!requireKey(res, apiKey)) return;
    const prompt = req.body?.prompt?.toString()?.trim();
    if (!prompt) return res.status(400).json({ message: "Image prompt is required" });

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: imageModel,
        prompt,
        size: "1024x1024",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ message: data?.error?.message || "Image generation failed" });
    }

    const imageUrl = data?.data?.[0]?.url;
    const b64 = data?.data?.[0]?.b64_json;
    if (!imageUrl && !b64) {
      return res.status(500).json({ message: "No image returned by AI provider" });
    }

    return res.json({
      imageUrl: imageUrl || `data:image/png;base64,${b64}`,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Image generation failed" });
  }
});

export default router;
