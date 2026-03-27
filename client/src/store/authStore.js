import { create } from "zustand";
import api from "../lib/axios";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { useChatStore } from "./chatStore";

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem("user") || "null"),
  token: localStorage.getItem("token") || null,

  login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    connectSocket(data.user._id);
    set({ user: data.user, token: data.token });
  },

  register: async (username, email, password) => {
    const payload = { username, email, password };
    try {
      const { data } = await api.post("/auth/register", payload);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      connectSocket(data.user._id);
      set({ user: data.user, token: data.token });
      return data;
    } catch (err) {
      // Live deployments (Render free tier) can cold-start; retry once after ping.
      const transientNetwork =
        !err?.response && (err?.code === "ERR_NETWORK" || err?.code === "ECONNABORTED");
      if (!transientNetwork) throw err;

      try {
        await api.get("/auth/ping");
        const { data } = await api.post("/auth/register", payload);
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        connectSocket(data.user._id);
        set({ user: data.user, token: data.token });
        return data;
      } catch (retryErr) {
        if (!retryErr?.response) {
          const wrapped = new Error("Cannot reach server. Please wait a moment and try again.");
          wrapped.code = retryErr?.code || err?.code;
          throw wrapped;
        }
        throw retryErr;
      }
    }
  },

  updateProfile: async (payload) => {
    const config =
      payload instanceof FormData
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : undefined;
    const { data } = await api.put("/users/profile", payload, config);
    localStorage.setItem("user", JSON.stringify(data));
    set({ user: data });
    useChatStore.getState().syncUserInConversations(data);
    return data;
  },

  syncUserFromRealtime: (updatedUser) => {
    const { user } = get();
    if (!user?._id || user._id !== updatedUser?._id) return;
    const merged = { ...user, ...updatedUser };
    localStorage.setItem("user", JSON.stringify(merged));
    set({ user: merged });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    disconnectSocket();
    set({ user: null, token: null });
  },

  initSocket: () => {
    const { user } = get();
    if (user) connectSocket(user._id);
  },
}));
