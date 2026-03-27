const DEFAULT_PROD_BACKEND = "https://chat-995k.onrender.com";

const stripSlash = (url) => url.replace(/\/$/, "");
const isLocalHostUrl = (url) => /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(url).trim());

export const resolveServerUrl = () => {
  const envUrl = (import.meta.env.VITE_SERVER_URL || "").trim();
  if (envUrl) {
    // Netlify/production must never point to localhost even if env var is misconfigured.
    if (!(import.meta.env.PROD && isLocalHostUrl(envUrl))) {
      return stripSlash(envUrl);
    }
  }

  if (import.meta.env.DEV) return "http://localhost:8000";

  try {
    const stored = (localStorage.getItem("backend_origin") || "").trim();
    if (stored) return stripSlash(stored);
  } catch {
    // ignore
  }

  return DEFAULT_PROD_BACKEND;
};
