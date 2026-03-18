import { create } from "zustand";
import api from "../lib/axios";
import { getSocket } from "../lib/socket";

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  onlineUsers: [],
  typingUsers: {}, // { conversationId: [userId, ...] }
  loading: false,
  activeLoadRequestId: null,

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  fetchConversations: async () => {
    const { data } = await api.get("/messages/conversations");
    set({ conversations: data });
  },

  setActiveConversation: async (conv) => {
    const { activeConversation, loading } = get();
    if (activeConversation?._id === conv._id && loading) return;
    if (activeConversation?._id === conv._id && !loading) return;

    const requestId = `${conv._id}-${Date.now()}`;
    set({ activeConversation: conv, messages: [], loading: true, activeLoadRequestId: requestId });
    const socket = getSocket();
    if (socket) socket.emit("joinConversation", conv._id);
    const { data } = await api.get(`/messages/${conv._id}`);
    if (get().activeLoadRequestId !== requestId) return;
    set({ messages: data, loading: false, activeLoadRequestId: null });
  },

  startConversation: async (userId) => {
    const { data } = await api.post("/messages/conversations", { userId });
    const { conversations } = get();
    const exists = conversations.find((c) => c._id === data._id);
    if (!exists) set({ conversations: [data, ...conversations] });
    if (get().activeConversation?._id !== data._id) {
      await get().setActiveConversation(data);
    }
    return data;
  },

  createGroup: async (groupName, participants) => {
    const { data } = await api.post("/messages/conversations", {
      isGroup: true,
      groupName,
      participants,
    });
    set((s) => ({ conversations: [data, ...s.conversations] }));
    get().setActiveConversation(data);
  },

  sendMessage: async (conversationId, text, mediaFile) => {
    const formData = new FormData();
    if (text) formData.append("text", text);
    if (mediaFile) formData.append("media", mediaFile);

    const { data } = await api.post(`/messages/${conversationId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    set((s) => {
      const exists = s.messages.some((m) => m._id === data._id);
      if (exists) return s;
      return { messages: [...s.messages, data] };
    });
    // Update last message in conversation list
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c._id === conversationId ? { ...c, lastMessage: data, updatedAt: new Date() } : c
      ),
    }));
    return data;
  },

  receiveMessage: (message) => {
    const { activeConversation, conversations } = get();
    if (activeConversation?._id === message.conversationId) {
      set((s) => {
        const exists = s.messages.some((m) => m._id === message._id);
        if (exists) return s;
        return { messages: [...s.messages, message] };
      });
    }
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c._id === message.conversationId
          ? { ...c, lastMessage: message, updatedAt: new Date() }
          : c
      ),
    }));
  },

  deleteMessage: async (messageId) => {
    await api.delete(`/messages/${messageId}`);
    set((s) => ({ messages: s.messages.filter((m) => m._id !== messageId) }));
  },

  editMessage: async (messageId, text) => {
    const { data } = await api.put(`/messages/${messageId}`, { text });
    set((s) => ({
      messages: s.messages.map((m) => (m._id === messageId ? data : m)),
    }));
  },

  updateEditedMessage: (message) => {
    set((s) => ({
      messages: s.messages.map((m) => (m._id === message._id ? message : m)),
    }));
  },

  setTyping: (conversationId, userId) => {
    set((s) => ({
      typingUsers: {
        ...s.typingUsers,
        [conversationId]: [...new Set([...(s.typingUsers[conversationId] || []), userId])],
      },
    }));
  },

  clearTyping: (conversationId, userId) => {
    set((s) => ({
      typingUsers: {
        ...s.typingUsers,
        [conversationId]: (s.typingUsers[conversationId] || []).filter((id) => id !== userId),
      },
    }));
  },
}));
