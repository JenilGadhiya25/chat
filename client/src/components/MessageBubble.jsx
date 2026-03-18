import { useState } from "react";
import { useChatStore } from "../store/chatStore";
import { format } from "date-fns";
import { SERVER_URL } from "../lib/axios";

// Resolve media URL — handle both absolute (Cloudinary) and relative (local) paths
const resolveUrl = (url) =>
  url?.startsWith("http") ? url : `${SERVER_URL}${url}`;

export default function MessageBubble({ message, isOwn }) {
  const { deleteMessage, editMessage } = useChatStore();
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);

  const handleEdit = async () => {
    if (!editText.trim()) return;
    await editMessage(message._id, editText);
    setEditing(false);
  };

  const statusIcon = isOwn
    ? message.status === "seen" ? "✓✓" : message.status === "delivered" ? "✓✓" : "✓"
    : null;

  const statusColor = message.status === "seen" ? "text-[#53bdeb]" : "text-[#8696a0]";

  return (
    <div className={`flex msg-enter ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[85%] lg:max-w-[70%] group ${isOwn ? "items-end" : "items-start"} flex flex-col`}
        onMouseLeave={() => setShowMenu(false)}
      >
        {/* Bubble */}
        <div
          className={`px-3.5 py-2 rounded-lg shadow-sm text-sm ${
            isOwn
              ? "bg-[var(--wa-bubble-own)] text-[var(--wa-text)] rounded-br-sm"
              : "bg-[var(--wa-bubble-other)] text-[var(--wa-text)] rounded-bl-sm"
          }`}
        >
          {/* Media */}
          {message.media?.url && (
            <div className="mb-1">
              {message.media.type === "image" ? (
                <img
                  src={resolveUrl(message.media.url)}
                  alt="media"
                  className="rounded-lg max-h-48 object-cover cursor-pointer"
                  onClick={() => window.open(resolveUrl(message.media.url), "_blank")}
                />
              ) : message.media.type === "video" ? (
                <video src={resolveUrl(message.media.url)} controls className="rounded-lg max-h-48 w-full" />
              ) : (
                <a
                  href={resolveUrl(message.media.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs underline"
                >
                  <span>📎</span>
                  <span>{message.media.name || "File"}</span>
                </a>
              )}
            </div>
          )}

          {/* Text or edit input */}
          {editing ? (
            <div className="flex gap-1">
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                className={`flex-1 bg-transparent border-b outline-none text-sm ${isOwn ? "border-[#7acb8a]" : "border-gray-300"}`}
                autoFocus
              />
              <button onClick={handleEdit} className="text-xs opacity-80 hover:opacity-100">✓</button>
              <button onClick={() => setEditing(false)} className="text-xs opacity-80 hover:opacity-100">✕</button>
            </div>
          ) : (
            message.text && (
              <p className="break-words">
                {message.text}
                {message.isEdited && <span className="text-xs opacity-60 ml-1">(edited)</span>}
              </p>
            )
          )}
        </div>

        {/* Timestamp + status */}
        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isOwn ? "flex-row-reverse" : ""}`}>
          <span className="text-xs text-[var(--wa-subtle)]">
            {format(new Date(message.createdAt), "HH:mm")}
          </span>
          {statusIcon && <span className={`text-xs ${statusColor}`}>{statusIcon}</span>}
        </div>

        {/* Context menu (own messages only) */}
        {isOwn && (
          <div className="absolute -top-2 right-0 hidden group-hover:flex gap-1 bg-[var(--wa-panel)] shadow-md rounded-lg px-2 py-1 z-10 border border-black/5">
            {message.text && (
              <button
                onClick={() => { setEditing(true); setShowMenu(false); }}
                className="text-xs text-[var(--wa-subtext)] hover:text-[#00a884]"
              >
                ✏️
              </button>
            )}
            <button
              onClick={() => deleteMessage(message._id)}
              className="text-xs text-[var(--wa-subtext)] hover:text-red-500"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
