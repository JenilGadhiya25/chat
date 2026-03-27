import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { connectSocket } from "../lib/socket";
import { io } from "socket.io-client";
import axios from "axios";
import toast from "react-hot-toast";
import { resolveServerUrl } from "../lib/serverUrl";

export default function QRConfirmPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const qrToken = params.get("token");
  const server = params.get("server") || resolveServerUrl();

  // Axios instance pointing at the correct server (LAN IP on phone)
  const serverApi = axios.create({ baseURL: `${server}/api` });
  serverApi.interceptors.request.use((cfg) => {
    const t = localStorage.getItem("token");
    if (t) cfg.headers.Authorization = `Bearer ${t}`;
    return cfg;
  });

  const [phase, setPhase] = useState("init"); // init | login | confirming | done | error
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const socketRef = useRef(null);

  const confirmQR = (userId) => {
    setPhase("confirming");
    const socket = io(server, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("qr:scan", { qrToken, userId }));

    socket.on("connect_error", () => {
      setPhase("error");
      toast.error("Cannot reach server. Make sure you're on the same WiFi.");
    });

    socket.on("qr:confirmed", () => {
      setPhase("done");
      socket.disconnect();
      // Phone also navigates to the app after confirming
      setTimeout(() => navigate("/", { replace: true }), 1800);
    });

    socket.on("qr:error", (msg) => {
      setPhase("error");
      toast.error(msg || "QR expired or invalid");
      socket.disconnect();
    });
  };

  useEffect(() => {
    if (!qrToken) { setPhase("error"); return; }
    if (user?._id) {
      // Already logged in on phone — confirm immediately
      confirmQR(user._id);
    } else {
      setPhase("login");
    }
    return () => socketRef.current?.disconnect();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      let userId;
      if (authMode === "login") {
        const { data } = await serverApi.post("/auth/login", { email: form.email, password: form.password });
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        useAuthStore.setState({ user: data.user, token: data.token });
        connectSocket(data.user._id);
        userId = data.user._id;
      } else {
        if (form.password.length < 6) { toast.error("Password min 6 chars"); setBusy(false); return; }
        const { data } = await serverApi.post("/auth/register", {
          username: form.username, email: form.email, password: form.password,
        });
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        useAuthStore.setState({ user: data.user, token: data.token });
        connectSocket(data.user._id);
        userId = data.user._id;
      }
      confirmQR(userId);
    } catch (err) {
      toast.error(err.response?.data?.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Phases ──────────────────────────────────────────────────────

  if (phase === "init") {
    return <Screen><Spinner /></Screen>;
  }

  if (phase === "confirming") {
    return (
      <Screen>
        <Spinner />
        <p className="text-gray-600 dark:text-gray-300 font-medium mt-4">Authorizing desktop…</p>
      </Screen>
    );
  }

  if (phase === "done") {
    return (
      <Screen>
        <div className="w-24 h-24 rounded-full bg-[#00a884] flex items-center justify-center mb-5 shadow-xl animate-bounce-once">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[#00a884] mb-2">Logged in!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Desktop is now authorized.<br />Opening your chats…
        </p>
        <div className="mt-4 flex gap-1.5">
          {[0,1,2].map(i => (
            <span key={i} className="w-2 h-2 rounded-full bg-[#00a884] animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </Screen>
    );
  }

  if (phase === "error") {
    return (
      <Screen>
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-red-500 mb-1">QR Expired or Invalid</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
          Go back to the desktop and scan a fresh QR code.
        </p>
        <button onClick={() => navigate("/")}
          className="px-5 py-2 bg-[#00a884] text-white rounded-lg text-sm font-medium">
          Go to app
        </button>
      </Screen>
    );
  }

  // phase === "login"
  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col">
      <div className="bg-[#00a884] px-5 py-4 flex items-center gap-3 shadow">
        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
        </svg>
        <div>
          <p className="text-white font-bold text-lg leading-tight">WhatsApp Web</p>
          <p className="text-white/75 text-xs">Sign in to authorize this device</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#1f2c33] rounded-2xl shadow-xl overflow-hidden">
          <div className="flex border-b border-gray-100 dark:border-gray-700">
            {["login", "register"].map((m) => (
              <button key={m} onClick={() => setAuthMode(m)}
                className={"flex-1 py-3 text-sm font-semibold capitalize transition border-b-2 " +
                  (authMode === m ? "border-[#00a884] text-[#00a884]" : "border-transparent text-gray-400 hover:text-gray-600")}>
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuth} className="p-6 space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-1">
              {authMode === "login" ? "Sign in to authorize the desktop browser" : "Create an account to get started"}
            </p>

            {authMode === "register" && (
              <input type="text" required placeholder="Username" value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] border-0" />
            )}
            <input type="email" required placeholder="Email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] border-0" />
            <input type="password" required placeholder="Password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] border-0" />

            <button type="submit" disabled={busy}
              className="w-full py-3 bg-[#00a884] hover:bg-[#008f6f] text-white font-bold rounded-xl transition disabled:opacity-60 text-sm">
              {busy ? "Please wait…" : authMode === "login" ? "Sign In & Open WhatsApp" : "Register & Open WhatsApp"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Screen({ children }) {
  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col items-center justify-center p-6">
      {children}
    </div>
  );
}

function Spinner() {
  return <div className="w-12 h-12 border-[3px] border-[#00a884] border-t-transparent rounded-full animate-spin" />;
}
