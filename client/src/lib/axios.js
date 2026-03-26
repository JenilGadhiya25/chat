import axios from "axios";

const resolveServerUrl = () => {
  const envUrl = (import.meta.env.VITE_SERVER_URL || "").trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  // In production builds, never fall back to localhost
  if (!import.meta.env.DEV) return "";
  return "http://localhost:8000";
};

const SERVER_URL = resolveServerUrl();

const api = axios.create({
  baseURL: `${SERVER_URL}/api`,
  timeout: 30000, // 30s — handles Render cold start without hanging forever
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

export { SERVER_URL };
