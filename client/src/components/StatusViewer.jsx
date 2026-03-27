import { useEffect, useRef, useState } from "react";
import { resolveMediaUrl } from "../lib/mediaUrl";
import { useAuthStore } from "../store/authStore";
import api from "../lib/axios";
import Avatar from "./Avatar";

const resolveUrl = (url) => {
  if (!url) return "";
  return resolveMediaUrl(url);
};

/**
 * Full-screen WhatsApp-style status viewer.
 * Props:
 *   groups  — array of { user, items[] }
 *   startIndex — which group to open first
 *   onClose
 *   onView(statusId) — called when a status item is shown
 */
export default function StatusViewer({ groups: initialGroups, startIndex = 0, onClose, onView, onDeleted }) {
  const { user } = useAuthStore();
  const [groups, setGroups] = useState(initialGroups);
  const [groupIdx, setGroupIdx] = useState(startIndex);
  const [itemIdx, setItemIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const timerRef = useRef(null);
  const DURATION = 5000; // ms per item

  const group = groups[groupIdx];
  const item = group?.items[itemIdx];
  const isOwnStatus = group?.user._id === user?._id;

  const handleDeleteItem = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/status/${item._id}`);

      // Remove the item from local groups state
      const updatedGroups = groups.map((g, gi) => {
        if (gi !== groupIdx) return g;
        return { ...g, items: g.items.filter((it) => it._id !== item._id) };
      }).filter((g) => g.items.length > 0); // drop empty groups

      // Notify parent to refresh
      onDeleted?.();

      if (updatedGroups.length === 0) {
        // No statuses left at all
        onClose();
        return;
      }

      setGroups(updatedGroups);

      // Recalculate position
      const newGroupCount = updatedGroups.length;
      const newGroupIdx = Math.min(groupIdx, newGroupCount - 1);
      const newItemCount = updatedGroups[newGroupIdx].items.length;
      const newItemIdx = Math.min(itemIdx, newItemCount - 1);

      setGroupIdx(newGroupIdx);
      setItemIdx(newItemIdx);
      setShowViewers(false);
    } catch {
      // silently ignore
    } finally {
      setDeleting(false);
    }
  };

  // Notify server this item was viewed
  useEffect(() => {
    if (item) onView?.(item._id);
  }, [item?._id]);

  // Progress bar timer
  useEffect(() => {
    setProgress(0);
    clearInterval(timerRef.current);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timerRef.current);
        goNext();
      }
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [groupIdx, itemIdx]);

  const goNext = () => {
    const group = groups[groupIdx];
    if (!group) { onClose(); return; }
    if (itemIdx < group.items.length - 1) {
      setItemIdx((i) => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((g) => g + 1);
      setItemIdx(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (itemIdx > 0) {
      setItemIdx((i) => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx((g) => g - 1);
      setItemIdx(0);
    }
  };

  if (!group || !item) return null;

  const mediaUrl = item.media?.url ? resolveUrl(item.media.url) : null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center" onClick={onClose}>
      {/* Card */}
      <div
        className="relative w-full max-w-sm h-full sm:h-[90vh] sm:rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
          {group.items.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{
                  width: i < itemIdx ? "100%" : i === itemIdx ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-4 left-0 right-0 z-10 flex items-center gap-3 px-3 pt-3">
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white flex-shrink-0">
            <Avatar src={group.user.avatar} name={group.user.username} size="sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">
              {isOwnStatus ? "My Status" : group.user.username}
            </p>
            <p className="text-white/60 text-xs">
              {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          {isOwnStatus && (
            <button
              onClick={handleDeleteItem}
              disabled={deleting}
              className="text-white/80 hover:text-red-400 p-1 transition disabled:opacity-50"
              title="Delete this status"
            >
              {deleting ? (
                <div className="w-5 h-5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          )}
          <button onClick={onClose} className="text-white/80 hover:text-white p-1">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center relative">
          {mediaUrl && item.media.type === "image" && (
            <img src={mediaUrl} alt="status" className="w-full h-full object-contain" />
          )}
          {mediaUrl && item.media.type === "video" && (
            <video src={mediaUrl} autoPlay muted loop className="w-full h-full object-contain" />
          )}
          {!mediaUrl && (
            <div
              className="w-full h-full flex items-center justify-center p-8"
              style={{ background: item.textBg || "#00a884" }}
            >
              <p className="text-white text-2xl font-semibold text-center leading-snug">{item.text}</p>
            </div>
          )}
          {mediaUrl && item.text && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
              <p className="text-white text-sm">{item.text}</p>
            </div>
          )}
        </div>

        {/* Viewer count — own status only */}
        {isOwnStatus && (
          <div
            className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/60 to-transparent px-4 py-3 flex items-center gap-2 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setShowViewers((v) => !v); }}
          >
            <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-white/80 text-xs font-medium">
              {item.viewers?.length || 0} view{item.viewers?.length !== 1 ? "s" : ""}
            </span>
            {showViewers && item.viewers?.length > 0 && (
              <div className="absolute bottom-10 left-4 right-4 bg-[#1f2c33] rounded-xl shadow-xl p-3 max-h-48 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}>
                <p className="text-xs text-[#8696a0] mb-2 font-medium uppercase tracking-wider">Viewed by</p>
                {item.viewers.map((v) => (
                  <div key={v._id || v} className="flex items-center gap-2 py-1.5">
                    <Avatar src={v.avatar} name={v.username || "User"} size="sm" />
                    <span className="text-sm text-[#e9edef]">{v.username || "User"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tap zones */}
        <div className="absolute inset-0 flex pointer-events-none">
          <div className="flex-1 pointer-events-auto" onClick={goPrev} />
          <div className="flex-1 pointer-events-auto" onClick={goNext} />
        </div>
      </div>

      {/* Dim sides on desktop */}
      <div className="hidden sm:block absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
