import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";
import QRConfirmPage from "./pages/QRConfirmPage";
import AllUsersPage from "./pages/AllUsersPage";
import PhonePage from "./pages/PhonePage";
import { useEffect } from "react";
import { initTheme } from "./lib/theme";

function PrivateRoute({ children }) {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/phone" replace />;
}

function GuestRoute({ children }) {
  const { token } = useAuthStore();
  // Also check localStorage directly — QRLogin writes there before zustand re-renders
  const hasToken = token || !!localStorage.getItem("token");
  return !hasToken ? children : <Navigate to="/" replace />;
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
        <Route path="/phone" element={<GuestRoute><PhonePage /></GuestRoute>} />
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="/qr-confirm" element={<QRConfirmPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
