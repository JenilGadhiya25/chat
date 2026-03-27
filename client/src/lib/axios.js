import axios from "axios";
import { resolveServerUrl } from "./serverUrl";

const SERVER_URL = resolveServerUrl();

const api = axios.create({
  baseURL: `${SERVER_URL}/api`,
  timeout: 70000, // Render free cold starts can take >30s
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    try {
      const base = response?.config?.baseURL || "";
      if (/^https?:\/\//i.test(base)) {
        const origin = new URL(base).origin;
        localStorage.setItem("backend_origin", origin);
      }
    } catch {
      // ignore
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export default api;

export { SERVER_URL };
