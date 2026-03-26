import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";
import QRConfirmPage from "./pages/QRConfirmPage";
import AllUsersPage from "./pages/AllUsersPage";
import PhoneAuthPage from "./pages/PhoneAuthPage";
import { useEffect } from "react";
import { initTheme } from "./lib/theme";

function PrivateRoute({ children }) {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { token } = useAuthStore();
  // Also check localStorage directly — QRLogin writes there before zustand re-renders
  const hasToken = token || !!localStorage.getItem("token");
  return !hasToken ? children : <Navigate to="/" replace />;
}

function PhoneVerifiedRoute({ children }) {
  const token = localStorage.getItem("phone_verify_token");
  const expiry = Number(localStorage.getItem("phone_verify_expires_at") || "0");
  const valid = token && expiry > Date.now();
  return valid ? children : <Navigate to="/phone-auth" replace />;
}

export default function App() {
  useEffect(() => {
    initTheme();
    const savedFont = localStorage.getItem("settings_font_size") || "medium";
    const map = { small: "14px", medium: "16px", large: "18px" };
    document.documentElement.style.fontSize = map[savedFont] || "16px";
  }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1f2c33",
            color: "#e9edef",
            borderRadius: "10px",
            fontSize: "14px",
          },
          success: { iconTheme: { primary: "#00a884", secondary: "#fff" } },
        }}
      />
      <Routes>
        <Route path="/" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute><AllUsersPage /></PrivateRoute>} />
        <Route path="/phone-auth" element={<GuestRoute><PhoneAuthPage /></GuestRoute>} />
        <Route path="/login" element={<GuestRoute><PhoneVerifiedRoute><LoginPage /></PhoneVerifiedRoute></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        {/* QR confirm — accessible when logged in on another device */}
        <Route path="/qr-confirm" element={<QRConfirmPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
