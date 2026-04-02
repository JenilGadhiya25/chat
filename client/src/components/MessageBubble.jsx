import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { format } from "date-fns";
import { resolveMediaUrl } from "../lib/mediaUrl";
import toast from "react-hot-toast";

const resolveUrl = (url) => resolveMediaUrl(url);
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function MessageBubble({ message, isOwn, onReply, onForward }) {
  const { deleteMessage, editMessage, reactToMessage, pinMessage, unpinMessage } = useChatStore();
  const { user } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [showInfo, setShowInfo] = useState(false);
  const menuRef = useRef(null);

  const handleEdit = async () => {
    if (!editText.trim()) return;
    await editMessage(message._id, editText);
    setEditing(false);
  };

  const statusIcon = isOwn
    ? message.status === "seen" ? "✓✓" : message.status === "delivered" ? "✓✓" : "✓"
    : null;
  const statusColor = message.status === "seen" ? "text-[#53bdeb]" : "text-gray-400";

  const groupedReactions = (message.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});
  const myReaction = (message.reactions || []).find(
    (r) => (r.user?._id || r.user)?.toString() === user?._id?.toString()
  )?.emoji;

  const handleReact = async (emoji) => {
    await reactToMessage(message._id, emoji);
    setShowMenu(false);
  };

  // Open context menu on right-click or long-press
  const openMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    setMenuPos({ x, y });
    setShowMenu(true);
  };

  // Long-press support for mobile
  const longPressTimer = useRef(null);
  const onTouchStart = (e) => {
    longPressTimer.current = setTimeout(() => openMenu(e), 500);
  };
  const onTouchEnd = () => clearTimeout(longPressTimer.current);

  // Close on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const menuItems = [
    {
      label: "Message info",
      show: isOwn,
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
      action: () => { setShowInfo(true); setShowMenu(false); },
    },
    {
      label: "Reply",
      show: true,
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>,
      action: () => { onReply?.(message); setShowMenu(false); },
    },
    {
      label: "Copy",
      show: !!message.text,
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>,
      action: () => { navigator.clipboard?.writeText(message.text); toast.success("Copied"); setShowMenu(false); },
    },
    {
      label: "React",
      show: true,
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
      action: null, // handled inline — shows emoji row
      isReact: true,
    },
    {
      label: "Forward",
      show: true,
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
      action: () => { onForward?.(message); setShowMenu(false); },
    },
    {
      label: message.pinnedAt ? "Unpin" : "Pin",
      show: true,
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>,
      action: async () => {
        setShowMenu(false);
        try {
          if (message.pinnedAt) { await unpinMessage(message._id); toast.success("Message unpinned"); }
          else { await pinMessage(message._id); toast.success("Message pinned"); }
        } catch { toast.error("Failed"); }
      },
    },
    {
      label: "Star",
      show: true,
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>,
      action: () => { toast("Star message coming soon"); setShowMenu(false); },
    },
    {
      label: isOwn ? "Edit" : null,
      show: isOwn && !!message.text,
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>,
      action: () => { setEditing(true); setShowMenu(false); },
    },
    {
      label: "Delete",
      show: true,
      danger: true,
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
      action: () => { deleteMessage(message._id); setShowMenu(false); },
    },
  ].filter((item) => item.show && item.label);

  // Compute safe menu position
  const safePos = () => {
    const menuW = 220, menuH = menuItems.length * 44 + 60;
    const vw = window.innerWidth, vh = window.innerHeight;
    return {
      left: Math.min(menuPos.x, vw - menuW - 8),
      top: menuPos.y + menuH > vh ? menuPos.y - menuH : menuPos.y,
    };
  };

  return (
    <div className={`flex msg-enter ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[88vw] sm:max-w-sm md:max-w-md ${isOwn ? "items-end" : "items-start"} flex flex-col`}
        onContextMenu={openMenu}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchEnd}
      >
        {/* Bubble */}
        <div
          className={`px-3 py-2 rounded-lg shadow-sm text-[14.2px] w-full cursor-pointer select-none ${
            isOwn
              ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-white rounded-br-none"
              : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none"
          }`}
        >
          {/* Media */}
          {message.media?.url && (
            <div className="mb-1 -mx-1 -mt-1 overflow-hidden rounded-t-lg">
              {message.media.type === "image" ? (
                <img src={resolveUrl(message.media.url)} alt="media"
                  className="max-w-full max-h-72 w-auto rounded-t-lg cursor-pointer object-contain bg-black/5"
                  onDoubleClick={() => window.open(resolveUrl(message.media.url), "_blank")}
                />
              ) : message.media.type === "video" ? (
                <video src={resolveUrl(message.media.url)} controls className="max-w-full max-h-72 rounded-t-lg" onClick={(e) => e.stopPropagation()} />
              ) : (
                <a href={resolveUrl(message.media.url)} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-500 transition">
                  <svg className="w-8 h-8 text-gray-500 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{message.media.name || "File"}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Click to download</p>
                  </div>
                </a>
              )}
            </div>
          )}

          {/* Reply quote */}
          {message.replyTo && (
            <div className={`mb-2 -mx-1 px-3 py-2 rounded-lg border-l-4 border-[#00a884] text-xs ${isOwn ? "bg-[#b7f0c8] dark:bg-[#004a3a]" : "bg-gray-100 dark:bg-gray-600"}`}>
              <p className="font-semibold text-[#00a884] truncate">{message.replyTo.sender?.username || "Unknown"}</p>
              <p className="text-gray-600 dark:text-gray-300 truncate mt-0.5">
                {message.replyTo.text || (message.replyTo.media?.url ? "📎 Media" : "")}
              </p>
            </div>
          )}

          {/* Text or edit input */}
          {editing ? (
            <div className="flex gap-1 items-center">
              <input value={editText} onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                className="flex-1 bg-transparent border-b border-gray-400 outline-none text-sm py-1" autoFocus />
              <button onClick={handleEdit} className="text-xs opacity-70 hover:opacity-100 px-1">✓</button>
              <button onClick={() => setEditing(false)} className="text-xs opacity-70 hover:opacity-100 px-1">✕</button>
            </div>
          ) : (
            message.text && (
              <p className="break-words leading-[1.4]">
                {message.text}
                {message.isEdited && <span className="text-xs opacity-60 ml-1 italic">(edited)</span>}
              </p>
            )
          )}

          {/* Timestamp + status */}
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{format(new Date(message.createdAt), "HH:mm")}</span>
            {statusIcon && <span className={`text-[11px] ${statusColor}`}>{statusIcon}</span>}
          </div>
        </div>

        {/* Reaction pills */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className={`mt-1 flex items-center gap-1 ${isOwn ? "justify-end" : "justify-start"} flex-wrap`}>
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <button key={emoji} onClick={() => handleReact(emoji)}
                className={`px-2 py-0.5 rounded-full text-xs border ${myReaction === emoji ? "bg-[#00a884]/15 border-[#00a884] text-[#00a884]" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"}`}>
                {emoji} {count}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Context menu — fixed position, portal-style */}
      {showMenu && (
        <div ref={menuRef}
          className="fixed z-[300] bg-white dark:bg-[#233138] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden w-56"
          style={safePos()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Emoji reactions row */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
            {REACTION_EMOJIS.map((emoji) => (
              <button key={emoji} onClick={() => handleReact(emoji)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition ${myReaction === emoji ? "bg-[#00a884]/20 ring-2 ring-[#00a884]" : ""}`}>
                {emoji}
              </button>
            ))}
            <button onClick={() => { toast("More reactions coming soon"); setShowMenu(false); }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition text-lg font-bold">
              +
            </button>
          </div>

          {/* Menu items */}
          {menuItems.map((item) => (
            <button key={item.label} onClick={item.action}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition hover:bg-gray-50 dark:hover:bg-[#182229] ${item.danger ? "text-red-500" : "text-gray-700 dark:text-[#e9edef]"}`}>
              <span className={item.danger ? "text-red-400" : "text-gray-400 dark:text-[#8696a0]"}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Message info modal */}
      {showInfo && (
        <div className="fixed inset-0 z-[400] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowInfo(false)}>
          <div className="bg-white dark:bg-[#1f2c33] rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Message info</h3>
              <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Sent</span>
                <span>{format(new Date(message.createdAt), "dd MMM yyyy, HH:mm")}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Status</span>
                <span className={message.status === "seen" ? "text-[#53bdeb]" : "text-gray-400"}>
                  {message.status === "seen" ? "✓✓ Read" : message.status === "delivered" ? "✓✓ Delivered" : "✓ Sent"}
                </span>
              </div>
              {message.isEdited && (
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Edited</span><span>Yes</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
