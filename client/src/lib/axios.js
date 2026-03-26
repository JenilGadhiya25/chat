import axios from "axios";

const resolveServerUrl = () => {
  const envUrl = (import.meta.env.VITE_SERVER_URL || "").trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  // Local dev fallback only
  if (import.meta.env.DEV) return "http://localhost:8000";

  // In production, default to same-origin API host
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
};

const SERVER_URL = resolveServerUrl();

const api = axios.create({
  baseURL: `${SERVER_URL}/api`,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

export { SERVER_URL };
