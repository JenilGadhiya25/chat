const DEFAULT_PROD_BACKEND = "https://chat-995k.onrender.com";

const stripSlash = (url) => url.replace(/\/$/, "");

export const resolveServerUrl = () => {
  const envUrl = (import.meta.env.VITE_SERVER_URL || "").trim();
  if (envUrl) return stripSlash(envUrl);

  if (import.meta.env.DEV) return "http://localhost:8000";

  try {
    const stored = (localStorage.getItem("backend_origin") || "").trim();
    if (stored) return stripSlash(stored);
  } catch {
    // ignore
  }

  return DEFAULT_PROD_BACKEND;
};

