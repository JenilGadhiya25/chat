import axios from "axios";

const SERVER_URL = (import.meta.env.VITE_SERVER_URL || "http://localhost:8000").replace(/\/$/, "");

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
