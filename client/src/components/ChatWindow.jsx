import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { getSocket } from "../lib/socket";
import { SERVER_URL } from "../lib/axios";
import MessageBubble from "./MessageBubble";
import Avatar from "./Avatar";
import EmojiPicker from "emoji-picker-react";

export default function ChatWindow() {
  const { activeConversation, messages, loading, sendMessage, typingUsers, onlineUsers } = useChatStore();
  const { user } = useAuthStore();
  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);

  const otherParticipant = activeConversation?.isGroup
    ? null
    : activeConversation?.participants?.find((p) => p._id !== user._id);

  const isOtherOnline = otherParticipant && onlineUsers.includes(otherParticipant._id);

  const convTyping = typingUsers[activeConversation?._id] || [];
  const isTyping = convTyping.some((id) => id !== user._id);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const emitTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("typing", { conversationId: activeConversation._id, userId: user._id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("stopTyping", { conversationId: activeConversation._id, userId: user._id });
    }, 1500);
  }, [activeConversation, user]);

  const handleTextChange = (e) => {
    setText(e.target.value);
    emitTyping();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMediaFile(file);
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      setMediaPreview(URL.createObjectURL(file));
    } else {
      setMediaPreview(null);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() && !mediaFile) return;
    setSending(true);
    try {
      await sendMessage(activeConversation._id, text.trim(), mediaFile);
      setText("");
      setMediaFile(null);
      setMediaPreview(null);
      setShowEmoji(false);
      const socket = getSocket();
      socket?.emit("stopTyping", { conversationId: activeConversation._id, userId: user._id });
    } finally {
      setSending(false);
    }
  };

  const onEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const convName = activeConversation?.isGroup
    ? activeConversation.groupName
    : otherParticipant?.username || "Unknown";
  const wallpaperUrl = user?.chatBackground
    ? user.chatBackground.startsWith("http")
      ? user.chatBackground
      : user.chatBackground.startsWith("/presets/")
        ? user.chatBackground
      : `${SERVER_URL}${user.chatBackground}`
    : "";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--wa-border)] bg-[var(--wa-panel-muted)]">
        <div className="relative">
          <Avatar src={otherParticipant?.avatar} name={convName} size="md" />
          {isOtherOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[var(--wa-panel-muted)] rounded-full" />
          )}
        </div>
        <div>
          <p className="font-semibold text-[var(--wa-text)]">{convName}</p>
          <p className="text-xs text-[var(--wa-subtext)]">
            {isTyping ? (
              <span className="text-[#00a884] animate-pulse">typing...</span>
            ) : isOtherOnline ? (
              "Online"
            ) : otherParticipant?.lastSeen ? (
              `Last seen ${new Date(otherParticipant.lastSeen).toLocaleTimeString()}`
            ) : (
              "Offline"
            )}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-5 space-y-2 chat-bg-pattern"
        style={
          wallpaperUrl
            ? {
                backgroundImage: `url(${wallpaperUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg._id} message={msg} isOwn={msg.sender._id === user._id || msg.sender === user._id} />
        ))}
        {isTyping && (
          <div className="flex items-end gap-2">
            <div className="bg-[var(--wa-bubble-other)] rounded-2xl rounded-bl-sm px-4 py-2 shadow-sm border border-black/5">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Media preview */}
      {mediaPreview && (
        <div className="px-4 py-2 bg-[var(--wa-panel-muted)] border-t border-[var(--wa-border)]">
          <div className="relative inline-block">
            {mediaFile?.type.startsWith("image/") ? (
              <img src={mediaPreview} alt="preview" className="h-20 rounded-lg object-cover" />
            ) : (
              <video src={mediaPreview} className="h-20 rounded-lg" />
            )}
            <button
              onClick={() => { setMediaFile(null); setMediaPreview(null); }}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {mediaFile && !mediaPreview && (
        <div className="px-4 py-2 bg-[var(--wa-panel-muted)] border-t border-[var(--wa-border)] flex items-center gap-2">
          <span className="text-2xl">📎</span>
          <span className="text-sm text-[var(--wa-text)] truncate">{mediaFile.name}</span>
          <button onClick={() => setMediaFile(null)} className="ml-auto text-red-500 text-sm">Remove</button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-end gap-2 px-4 py-3 bg-[var(--wa-panel-muted)] border-t border-[var(--wa-border)] relative">
        {showEmoji && (
          <div className="absolute bottom-16 left-4 z-50">
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              theme={document.documentElement.classList.contains("dark") ? "dark" : "light"}
              height={350}
            />
          </div>
        )}

        <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 text-[var(--wa-subtext)] hover:text-[#00a884] transition text-xl">
          😊
        </button>

        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-[var(--wa-subtext)] hover:text-[#00a884] transition text-xl">
          📎
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />

        <input
          type="text"
          value={text}
          onChange={handleTextChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--wa-input-border)] bg-[var(--wa-input-bg)] text-[var(--wa-text)] focus:outline-none focus:ring-2 focus:ring-[#00a884]/25 text-sm"
        />

        <button
          type="submit"
          disabled={sending || (!text.trim() && !mediaFile)}
          className="p-2.5 bg-[#00a884] hover:bg-[#029477] text-white rounded-full transition disabled:opacity-50 flex-shrink-0"
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
