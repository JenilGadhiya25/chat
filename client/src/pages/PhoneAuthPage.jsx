import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../lib/axios";
import QRLogin from "../components/QRLogin";

const COUNTRIES = [
  { code: "+91", name: "India" },
  { code: "+1", name: "United States" },
  { code: "+44", name: "United Kingdom" },
  { code: "+61", name: "Australia" },
  { code: "+971", name: "UAE" },
];

export default function PhoneAuthPage() {
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const navigate = useNavigate();

  const sendOtp = async () => {
    if (!phoneNumber.trim()) return toast.error("Enter mobile number");
    setLoading(true);
    try {
      await api.post("/auth/otp/send", { countryCode, phoneNumber });
      setOtpSent(true);
      toast.success("OTP sent");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return toast.error("Enter OTP");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/otp/verify", {
        countryCode,
        phoneNumber,
        otp,
      });
      localStorage.setItem("phone_verify_token", data.phoneVerifyToken);
      localStorage.setItem("phone_verify_expires_at", String(Date.now() + (data.expiresInSec || 900) * 1000));
      toast.success("Phone verified");
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#111b21] p-4">
      <div className="w-full h-[220px] bg-[#00a884] absolute top-0 left-0" />
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#1f2c33] rounded-2xl shadow-xl p-7">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-1">Verify Mobile Number</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Enter your number to receive an OTP before login.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Mobile Number
            </label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-36 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-[#f0f2f5] dark:bg-[#2a3942] text-gray-900 dark:text-white text-sm"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d]/g, ""))}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-[#f0f2f5] dark:bg-[#2a3942] text-gray-900 dark:text-white text-sm"
                placeholder="Enter mobile number"
              />
            </div>
          </div>

          {otpSent && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                OTP
              </label>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, ""))}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-[#f0f2f5] dark:bg-[#2a3942] text-gray-900 dark:text-white text-sm"
                placeholder="Enter OTP"
              />
            </div>
          )}

          {!otpSent ? (
            <button onClick={sendOtp} disabled={loading} className="w-full py-3 bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold rounded-lg transition disabled:opacity-60 text-sm">
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          ) : (
            <button onClick={verifyOtp} disabled={loading} className="w-full py-3 bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold rounded-lg transition disabled:opacity-60 text-sm">
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          )}

          <button
            onClick={() => setShowQR(true)}
            className="w-full py-3 border-2 border-[#00a884] text-[#00a884] font-semibold rounded-lg hover:bg-[#00a884]/5 transition text-sm"
          >
            Open with QR Scanner
          </button>
        </div>
      </div>
      {showQR && <QRLogin onClose={() => setShowQR(false)} />}
    </div>
  );
}
