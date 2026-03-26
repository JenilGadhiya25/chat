import { create } from "zustand";
import api from "../lib/axios";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { useChatStore } from "./chatStore";

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem("user") || "null"),
  token: localStorage.getItem("token") || null,

  login: async (email, password) => {
    const phoneVerifyToken = localStorage.getItem("phone_verify_token");
    const { data } = await api.post(
      "/auth/login",
      { email, password },
      { headers: { "x-phone-verify-token": phoneVerifyToken || "" } }
    );
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.removeItem("phone_verify_token");
    localStorage.removeItem("phone_verify_expires_at");
    connectSocket(data.user._id);
    set({ user: data.user, token: data.token });
  },

  register: async (username, email, password) => {
    const { data } = await api.post("/auth/register", { username, email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    connectSocket(data.user._id);
    set({ user: data.user, token: data.token });
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

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("phone_verify_token");
    localStorage.removeItem("phone_verify_expires_at");
    disconnectSocket();
    set({ user: null, token: null });
  },

  initSocket: () => {
    const { user } = get();
    if (user) connectSocket(user._id);
  },
}));
