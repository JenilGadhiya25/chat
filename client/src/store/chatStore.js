import { create } from "zustand";
import api from "../lib/axios";
import { getSocket } from "../lib/socket";

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  onlineUsers: [],
  typingUsers: {},
  callLogs: [],
  loading: false,

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  fetchConversations: async () => {
    try {
      const { data } = await api.get("/messages/conversations");
      set({ conversations: data });
    } catch {
      // Silently fail — user will see empty list
    }
  },

  fetchCallLogs: async () => {
    try {
      const { data } = await api.get("/messages/calls");
      set({ callLogs: data });
    } catch {
      set({ callLogs: [] });
    }
  },

  setActiveConversation: async (conv) => {
    // Avoid reloading the same conversation
    if (get().activeConversation?._id === conv._id) return;

    set({ activeConversation: conv, messages: [], loading: true });

    const socket = getSocket();
    if (socket) socket.emit("joinConversation", conv._id);

    try {
      const { data } = await api.get(`/messages/${conv._id}`);
      // Only apply if this conversation is still active
      if (get().activeConversation?._id === conv._id) {
        set({ messages: data, loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  startConversation: async (userId) => {
    const { data } = await api.post("/messages/conversations", { userId });
    set((s) => {
      const exists = s.conversations.find((c) => c._id === data._id);
      return exists
        ? s
        : { conversations: [data, ...s.conversations] };
    });
    await get().setActiveConversation(data);
    return data;
  },

  createGroup: async (groupName, participants, groupAvatar, groupDescription) => {
    const fd = new FormData();
    fd.append("isGroup", "true");
    fd.append("groupName", groupName);
    fd.append("participants", JSON.stringify(participants));
    if (groupDescription) fd.append("groupDescription", groupDescription);
    if (groupAvatar) fd.append("groupAvatar", groupAvatar);
    const { data } = await api.post("/messages/conversations", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    set((s) => ({ conversations: [data, ...s.conversations] }));
    get().setActiveConversation(data);
    return data;
  },

  updateConversationInState: (conversation) => {
    if (!conversation?._id) return;
    set((s) => ({
      conversations: s.conversations.map((c) => (c._id === conversation._id ? conversation : c)),
      activeConversation:
        s.activeConversation?._id === conversation._id ? conversation : s.activeConversation,
    }));
  },

  syncUserInConversations: (updatedUser) => {
    if (!updatedUser?._id) return;
    set((s) => {
      const mapParticipant = (p) => (p?._id === updatedUser._id ? { ...p, ...updatedUser } : p);
      const mapMessageSender = (m) => (
        m?.sender?._id === updatedUser._id
          ? { ...m, sender: { ...m.sender, ...updatedUser } }
          : m
      );
      return {
        conversations: s.conversations.map((conv) => ({
          ...conv,
          participants: conv.participants?.map(mapParticipant) || conv.participants,
          admins: conv.admins?.map((a) => (a?._id === updatedUser._id ? { ...a, ...updatedUser } : a)) || conv.admins,
          createdBy: conv.createdBy?._id === updatedUser._id ? { ...conv.createdBy, ...updatedUser } : conv.createdBy,
        })),
        activeConversation: s.activeConversation
          ? {
              ...s.activeConversation,
              participants: s.activeConversation.participants?.map(mapParticipant) || s.activeConversation.participants,
              admins: s.activeConversation.admins?.map((a) => (a?._id === updatedUser._id ? { ...a, ...updatedUser } : a)) || s.activeConversation.admins,
              createdBy: s.activeConversation.createdBy?._id === updatedUser._id
                ? { ...s.activeConversation.createdBy, ...updatedUser }
                : s.activeConversation.createdBy,
            }
          : s.activeConversation,
        messages: s.messages.map(mapMessageSender),
      };
    });
  },

  syncUserInCallLogs: (updatedUser) => {
    if (!updatedUser?._id) return;
    set((s) => ({
      callLogs: s.callLogs.map((log) => {
        const initiatedBy =
          log?.initiatedBy?._id === updatedUser._id
            ? { ...log.initiatedBy, ...updatedUser }
            : log?.initiatedBy;

        const conv = log?.conversationId;
        if (!conv) return { ...log, initiatedBy };

        return {
          ...log,
          initiatedBy,
          conversationId: {
            ...conv,
            participants: conv.participants?.map((p) =>
              p?._id === updatedUser._id ? { ...p, ...updatedUser } : p
            ),
            admins: conv.admins?.map((a) =>
              a?._id === updatedUser._id ? { ...a, ...updatedUser } : a
            ),
            createdBy:
              conv.createdBy?._id === updatedUser._id
                ? { ...conv.createdBy, ...updatedUser }
                : conv.createdBy,
          },
        };
      }),
    }));
  },

  pinConversation: async (convId) => {
    const { data } = await api.post(`/messages/conversations/${convId}/pin`);
    set((s) => ({ conversations: s.conversations.map((c) => c._id === convId ? data : c) }));
  },

  unpinConversation: async (convId) => {
    const { data } = await api.post(`/messages/conversations/${convId}/unpin`);
    set((s) => ({ conversations: s.conversations.map((c) => c._id === convId ? data : c) }));
  },

  archiveConversation: async (convId) => {
    const { data } = await api.post(`/messages/conversations/${convId}/archive`);
    set((s) => ({ conversations: s.conversations.map((c) => c._id === convId ? data : c) }));
    // If this was the active conversation, deselect it
    if (get().activeConversation?._id === convId) set({ activeConversation: null });
  },

  unarchiveConversation: async (convId) => {
    const { data } = await api.post(`/messages/conversations/${convId}/unarchive`);
    set((s) => ({ conversations: s.conversations.map((c) => c._id === convId ? data : c) }));
  },

  sendMessage: async (conversationId, text, mediaFile) => {
    const formData = new FormData();
    if (text) formData.append("text", text);
    if (mediaFile) formData.append("media", mediaFile);

    const { data } = await api.post(`/messages/${conversationId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // Add to messages list (sender side — REST response)
    set((s) => ({
      messages: s.messages.some((m) => m._id === data._id)
        ? s.messages
        : [...s.messages, data],
    }));

    // Bubble conversation to top with latest message
    set((s) => ({
      conversations: [
        { ...s.conversations.find((c) => c._id === conversationId), lastMessage: data, updatedAt: new Date() },
        ...s.conversations.filter((c) => c._id !== conversationId),
      ],
    }));

    return data;
  },

  // Called by socket "newMessage" event (receiver side)
  receiveMessage: (message) => {
    const { activeConversation } = get();

    // Append to messages if this conversation is open
    if (activeConversation?._id === message.conversationId) {
      set((s) => ({
        messages: s.messages.some((m) => m._id === message._id)
          ? s.messages
          : [...s.messages, message],
      }));
    }

    // Bubble conversation to top
    set((s) => {
      const existing = s.conversations.find((c) => c._id === message.conversationId);
      if (!existing) return s;
      return {
        conversations: [
          { ...existing, lastMessage: message, updatedAt: new Date() },
          ...s.conversations.filter((c) => c._id !== message.conversationId),
        ],
      };
    });
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

  reactToMessage: async (messageId, emoji) => {
    const { data } = await api.post(`/messages/${messageId}/reaction`, { emoji });
    set((s) => ({
      messages: s.messages.map((m) => (m._id === messageId ? data : m)),
    }));
    return data;
  },

  updateMessageReaction: (message) => {
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

  deleteConversation: async (convId) => {
    await api.delete(`/messages/conversations/${convId}`);
    set((s) => ({
      conversations: s.conversations.filter((c) => c._id !== convId),
      activeConversation: s.activeConversation?._id === convId ? null : s.activeConversation,
      messages: s.activeConversation?._id === convId ? [] : s.messages,
    }));
  },

  blockUser: async (userId) => {
    await api.post(`/messages/block/${userId}`);
  },

  unblockUser: async (userId) => {
    await api.post(`/messages/unblock/${userId}`);
  },

  addGroupAdmin: async (convId, userId) => {
    const { data } = await api.post(`/messages/conversations/${convId}/admins`, { userId });
    get().updateConversationInState(data);
    return data;
  },

  removeGroupAdmin: async (convId, userId) => {
    const { data } = await api.delete(`/messages/conversations/${convId}/admins/${userId}`);
    get().updateConversationInState(data);
    return data;
  },

  removeGroupParticipant: async (convId, userId) => {
    const { data } = await api.delete(`/messages/conversations/${convId}/participants/${userId}`);
    get().updateConversationInState(data);
    return data;
  },

  updateGroupProfile: async (convId, payload) => {
    const config =
      payload instanceof FormData
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : undefined;
    const { data } = await api.put(`/messages/conversations/${convId}/group-profile`, payload, config);
    get().updateConversationInState(data);
    return data;
  },

  logCall: async (conversationId, payload) => {
    const { data } = await api.post(`/messages/conversations/${conversationId}/calls`, payload || {});
    set((s) => ({ callLogs: [data, ...s.callLogs] }));
    return data;
  },
}));
