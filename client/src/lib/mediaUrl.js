import api, { SERVER_URL } from "./axios";

const normalizeOrigin = (value) => {
  if (!value) return "";
  try {
    const u = new URL(value);
    if (typeof window !== "undefined" && window.location.protocol === "https:" && u.protocol === "http:") {
      u.protocol = "https:";
    }
    return u.origin.replace(/\/$/, "");
  } catch {
    return "";
  }
};

export const getBackendOrigin = () => {
  const direct = normalizeOrigin(SERVER_URL);
  if (direct) return direct;

  const fromStorage = normalizeOrigin(localStorage.getItem("backend_origin") || "");
  if (fromStorage) return fromStorage;

  const base = api.defaults.baseURL || "";
  if (/^https?:\/\//i.test(base)) {
    return normalizeOrigin(base.replace(/\/api\/?$/i, ""));
  }
  return "";
};

export const resolveMediaUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("/presets/")) return url;
  const origin = getBackendOrigin();
  return origin ? `${origin}${url}` : url;
};

