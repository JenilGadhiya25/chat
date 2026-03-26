import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const signPhoneVerificationToken = (phone) =>
  jwt.sign({ phone, purpose: "phone_verified" }, process.env.JWT_SECRET, { expiresIn: "15m" });

const normalizeE164 = (countryCode = "", phoneNumber = "") => {
  const cc = String(countryCode).replace(/[^\d+]/g, "");
  const pn = String(phoneNumber).replace(/[^\d]/g, "");
  const raw = `${cc}${pn}`.replace(/[^\d+]/g, "");
  return raw.startsWith("+") ? raw : `+${raw.replace(/[^\d]/g, "")}`;
};

const requireTwilioConfig = (res) => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID) {
    return {
      accountSid: TWILIO_ACCOUNT_SID,
      authToken: TWILIO_AUTH_TOKEN,
      verifyServiceSid: TWILIO_VERIFY_SERVICE_SID,
    };
  }
  res.status(500).json({
    message:
      "OTP service is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID in server/.env",
  });
  return null;
};

const twilioVerifyRequest = async ({ accountSid, authToken, verifyServiceSid, endpoint, params }) => {
  const url = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/${endpoint}`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams(params);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "OTP provider request failed");
  }
  return data;
};

// POST /api/auth/otp/send
router.post("/otp/send", async (req, res) => {
  try {
    const cfg = requireTwilioConfig(res);
    if (!cfg) return;
    const { countryCode, phoneNumber } = req.body || {};
    const to = normalizeE164(countryCode, phoneNumber);
    if (!/^\+\d{8,15}$/.test(to)) {
      return res.status(400).json({ message: "Enter a valid mobile number" });
    }

    await twilioVerifyRequest({
      ...cfg,
      endpoint: "Verifications",
      params: { To: to, Channel: "sms" },
    });

    res.json({ success: true, to });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to send OTP" });
  }
});

// POST /api/auth/otp/verify
router.post("/otp/verify", async (req, res) => {
  try {
    const cfg = requireTwilioConfig(res);
    if (!cfg) return;
    const { countryCode, phoneNumber, otp } = req.body || {};
    const to = normalizeE164(countryCode, phoneNumber);
    if (!otp) return res.status(400).json({ message: "OTP is required" });

    const result = await twilioVerifyRequest({
      ...cfg,
      endpoint: "VerificationCheck",
      params: { To: to, Code: String(otp).trim() },
    });

    if (result?.status !== "approved") {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    const phoneVerifyToken = signPhoneVerificationToken(to);
    res.json({
      success: true,
      verified: true,
      phone: to,
      phoneVerifyToken,
      expiresInSec: 15 * 60,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to verify OTP" });
  }
});

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
    const phoneVerifyToken = req.headers["x-phone-verify-token"];
    if (!phoneVerifyToken) {
      return res.status(401).json({ message: "Phone OTP verification required before login" });
    }
    try {
      const decoded = jwt.verify(phoneVerifyToken, process.env.JWT_SECRET);
      if (decoded?.purpose !== "phone_verified") {
        return res.status(401).json({ message: "Invalid phone verification token" });
      }
    } catch {
      return res.status(401).json({ message: "Phone verification expired. Verify OTP again" });
    }

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

export default router;
