import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";
import QRLogin from "../components/QRLogin";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      setTimeout(() => navigate("/", { replace: true }), 50);
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#111b21] p-4">
      {/* WhatsApp-style top green bar */}
      <div className="w-full h-[220px] bg-[#00a884] absolute top-0 left-0" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-lg mb-3">
            <svg className="w-9 h-9 text-[#00a884]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </div>
          <h1 className="text-2xl font-light text-gray-800 dark:text-white tracking-wide">WhatsApp</h1>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#1f2c33] rounded-2xl shadow-xl overflow-hidden">
          <div className="px-8 pt-8 pb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-1">Sign in</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Phone verified. Enter your email and password to continue</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-[#f0f2f5] dark:bg-[#2a3942] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:border-transparent text-sm"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-[#f0f2f5] dark:bg-[#2a3942] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:border-transparent text-sm"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold rounded-lg transition disabled:opacity-60 text-sm"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
            </div>

            {/* QR Login */}
            <button
              onClick={() => setShowQR(true)}
              className="w-full py-3 border-2 border-[#00a884] text-[#00a884] font-semibold rounded-lg hover:bg-[#00a884]/5 transition flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3v3m-3-6v.01M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4z" />
              </svg>
              Log in with QR Code
            </button>
          </div>

          <div className="px-8 py-4 bg-gray-50 dark:bg-[#111b21] border-t border-gray-100 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Don't have an account?{" "}
              <Link to="/register" className="text-[#00a884] font-semibold hover:underline">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>

      {showQR && <QRLogin onClose={() => setShowQR(false)} />}
    </div>
  );
}
