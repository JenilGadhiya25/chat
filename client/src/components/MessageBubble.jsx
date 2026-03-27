import { useState } from "react";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { format } from "date-fns";
import { resolveMediaUrl } from "../lib/mediaUrl";

const resolveUrl = (url) => resolveMediaUrl(url);
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function MessageBubble({ message, isOwn }) {
  const { deleteMessage, editMessage, reactToMessage } = useChatStore();
  const { user } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [showReactions, setShowReactions] = useState(false);

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
  const myReaction = (message.reactions || []).find((r) => (r.user?._id || r.user)?.toString() === user?._id?.toString())?.emoji;

  const handleReact = async (emoji) => {
    await reactToMessage(message._id, emoji);
    setShowReactions(false);
  };

  return (
    <div className={`flex msg-enter ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[75vw] sm:max-w-sm md:max-w-md group ${isOwn ? "items-end" : "items-start"} flex flex-col`}
        onMouseLeave={() => { setShowMenu(false); setShowReactions(false); }}
      >
        {showReactions && (
          <div className={`absolute ${isOwn ? "right-0" : "left-0"} -top-10 z-20 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full shadow-lg px-2 py-1 flex items-center gap-1`}>
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition ${myReaction === emoji ? "bg-gray-100 dark:bg-gray-600" : ""}`}
                title={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Bubble */}
        <div
          className={`px-3 py-2 rounded-lg shadow-sm text-[14.2px] w-full ${
            isOwn
              ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-white rounded-br-none"
              : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none"
          }`}
          onClick={() => setShowReactions((s) => !s)}
        >
          {/* Media */}
          {message.media?.url && (
            <div className="mb-1 -mx-1 -mt-1 overflow-hidden rounded-t-lg">
              {message.media.type === "image" ? (
                <img
                  src={resolveUrl(message.media.url)}
                  alt="media"
                  className="max-w-full max-h-72 w-auto rounded-t-lg cursor-pointer object-contain bg-black/5"
                  onClick={(e) => { e.stopPropagation(); setShowReactions((s) => !s); }}
                  onDoubleClick={() => window.open(resolveUrl(message.media.url), "_blank")}
                />
              ) : message.media.type === "video" ? (
                <video src={resolveUrl(message.media.url)} controls className="max-w-full max-h-72 rounded-t-lg" onClick={(e) => e.stopPropagation()} />
              ) : (
                <a
                  href={resolveUrl(message.media.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-500 transition"
                >
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

          {/* Text or edit input */}
          {editing ? (
            <div className="flex gap-1 items-center">
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                className="flex-1 bg-transparent border-b border-gray-400 outline-none text-sm py-1"
                autoFocus
              />
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

          {/* Timestamp + status - WhatsApp style (bottom right corner) */}
          <div className={`flex items-center justify-end gap-1 mt-1 ${isOwn ? "flex-row" : "flex-row"}`}>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {format(new Date(message.createdAt), "HH:mm")}
            </span>
            {statusIcon && <span className={`text-[11px] ${statusColor}`}>{statusIcon}</span>}
          </div>
        </div>

        {Object.keys(groupedReactions).length > 0 && (
          <div className={`mt-1 flex items-center gap-1 ${isOwn ? "justify-end" : "justify-start"} flex-wrap`}>
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className={`px-2 py-0.5 rounded-full text-xs border ${myReaction === emoji ? "bg-[#00a884]/15 border-[#00a884] text-[#00a884]" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"}`}
              >
                {emoji} {count}
              </button>
            ))}
          </div>
        )}

        {/* Context menu (own messages only) - WhatsApp style */}
        {isOwn && (
          <div className="absolute -top-8 right-0 hidden group-hover:flex gap-1 bg-white dark:bg-gray-700 shadow-lg rounded-lg px-2 py-1.5 z-10 border border-gray-200 dark:border-gray-600">
            {message.text && (
              <button
                onClick={() => { setEditing(true); setShowMenu(false); }}
                className="text-xs text-gray-600 dark:text-gray-300 hover:text-[#00a884] px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                title="Edit"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => deleteMessage(message._id)}
              className="text-xs text-gray-600 dark:text-gray-300 hover:text-red-500 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
