import { useRef, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import { SERVER_URL } from "../lib/axios";
import Avatar from "./Avatar";
import toast from "react-hot-toast";

const resolveUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("/presets/")) return url;
  return `${SERVER_URL}${url}`;
};

export default function ContactInfoPanel({ onClose }) {
  const {
    activeConversation,
    messages,
    onlineUsers,
    deleteConversation,
    blockUser,
    unblockUser,
    addGroupAdmin,
    removeGroupAdmin,
    removeGroupParticipant,
    updateGroupProfile,
  } = useChatStore();
  const { user } = useAuthStore();
  const [notifOn, setNotifOn] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [memberBusyId, setMemberBusyId] = useState(null);
  const groupAvatarInputRef = useRef(null);

  const isGroup = activeConversation?.isGroup;
  const other = isGroup
    ? null
    : activeConversation?.participants?.find((p) => p._id !== user._id);

  const name = isGroup ? activeConversation?.groupName : other?.username || "Unknown";
  const avatarSrc = isGroup ? activeConversation?.groupAvatar : other?.avatar;
  const isOnline = !isGroup && other && onlineUsers.includes(other._id);
  const bio = isGroup
    ? activeConversation?.groupDescription || "Group chat"
    : other?.bio || "Hey there! I'm using WhatsApp.";
  const adminsRaw = activeConversation?.admins?.length
    ? activeConversation.admins
    : activeConversation?.admin
      ? [activeConversation.admin]
      : [];
  const adminIds = new Set(adminsRaw.map((a) => (a?._id || a)?.toString()));
  const creatorId = (activeConversation?.createdBy?._id || activeConversation?.createdBy || activeConversation?.admin)?.toString();
  const isCurrentUserGroupAdmin = isGroup && adminIds.has(user?._id?.toString());
  const isUserAdmin = (participantId) => adminIds.has(participantId?.toString());
  const isCreator = (participantId) => creatorId && participantId?.toString() === creatorId;

  // Shared images from current messages
  const sharedMedia = messages
    .filter((m) => m.media?.url && m.media?.type === "image")
    .slice(-6)
    .reverse();

  const handleDelete = async () => {
    if (!window.confirm(`Delete this conversation? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteConversation(activeConversation._id);
      toast.success("Conversation deleted");
      onClose();
    } catch {
      toast.error("Failed to delete conversation");
    } finally {
      setBusy(false);
    }
  };

  const handleBlock = async () => {
    if (!other) return;
    setBusy(true);
    try {
      if (blocked) {
        await unblockUser(other._id);
        setBlocked(false);
        toast.success(`${name} unblocked`);
      } else {
        if (!window.confirm(`Block ${name}? They won't be able to send you messages.`)) {
          setBusy(false);
          return;
        }
        await blockUser(other._id);
        setBlocked(true);
        toast.success(`${name} blocked`);
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAdmin = async (participant) => {
    const targetId = participant._id?.toString();
    if (!targetId || !isCurrentUserGroupAdmin) return;
    setMemberBusyId(targetId);
    try {
      if (isUserAdmin(targetId)) {
        await removeGroupAdmin(activeConversation._id, targetId);
        toast.success(`${participant.username} is no longer an admin`);
      } else {
        await addGroupAdmin(activeConversation._id, targetId);
        toast.success(`${participant.username} is now an admin`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update role");
    } finally {
      setMemberBusyId(null);
    }
  };

  const handleRemoveParticipant = async (participant) => {
    const targetId = participant._id?.toString();
    if (!targetId || !isCurrentUserGroupAdmin) return;
    if (!window.confirm(`Remove ${participant.username} from this group?`)) return;
    setMemberBusyId(targetId);
    try {
      await removeGroupParticipant(activeConversation._id, targetId);
      toast.success(`${participant.username} removed from group`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to remove participant");
    } finally {
      setMemberBusyId(null);
    }
  };

  const handleGroupAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !isGroup || !isCurrentUserGroupAdmin) return;
    const fd = new FormData();
    fd.append("groupAvatar", file);
    setBusy(true);
    try {
      await updateGroupProfile(activeConversation._id, fd);
      toast.success("Group photo updated");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update group photo");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="w-[340px] flex-shrink-0 h-full flex flex-col bg-[#f0f2f5] dark:bg-[#111b21] border-l border-gray-200 dark:border-[#2a3942] overflow-y-auto">

      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-4 bg-[#00a884] text-white flex-shrink-0">
        <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="font-semibold text-[15px]">{isGroup ? "Group Info" : "Contact Info"}</span>
      </div>

      {/* Avatar + name block */}
      <div className="flex flex-col items-center pt-8 pb-6 px-4 bg-white dark:bg-[#1f2c33]">
        <div className="relative mb-4 flex-shrink-0" style={{ width: 112, height: 112 }}>
          <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-[#00a884]/25 shadow-lg bg-[#2a3942]">
            <Avatar src={avatarSrc} name={name} size="xxl" />
          </div>
          {isGroup && isCurrentUserGroupAdmin && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => groupAvatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-md hover:bg-[#008f6f] disabled:opacity-60"
                title="Change group photo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <input
                ref={groupAvatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleGroupAvatarPick}
              />
            </>
          )}
          {isOnline && (
            <span className="absolute bottom-1 right-1 w-5 h-5 bg-[#00a884] border-[3px] border-white dark:border-[#1f2c33] rounded-full" />
          )}
        </div>

        <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center">{name}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center px-6 leading-relaxed">{bio}</p>

        {isOnline ? (
          <span className="mt-2 text-xs text-[#00a884] font-medium">● Online</span>
        ) : !isGroup && other?.lastSeen ? (
          <span className="mt-2 text-xs text-gray-400">
            Last seen {new Date(other.lastSeen).toLocaleString([], {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </span>
        ) : null}
      </div>

      {/* Email / Group members */}
      <div className="mt-2 bg-white dark:bg-[#1f2c33] px-5 py-4">
        {isGroup ? (
          <>
            <p className="text-xs text-[#00a884] font-semibold uppercase tracking-wider mb-3">
              {activeConversation.participants?.length} participants
            </p>
            <div className="space-y-3">
              {activeConversation.participants?.map((p) => {
                const participantId = p._id?.toString();
                const isSelf = participantId === user?._id?.toString();
                return (
                <div key={p._id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-[#2a3942]">
                    <Avatar src={p.avatar} name={p.username} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {isSelf ? "You" : p.username}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isUserAdmin(p._id) && (
                        <p className="text-xs text-[#00a884]">Group admin</p>
                      )}
                      {isCreator(p._id) && (
                        <p className="text-xs text-[#8696a0]">Creator</p>
                      )}
                    </div>
                  </div>
                  {onlineUsers.includes(p._id) && (
                    <span className="w-2 h-2 rounded-full bg-[#00a884] flex-shrink-0" />
                  )}
                  {isGroup && isCurrentUserGroupAdmin && !isSelf && (
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => handleToggleAdmin(p)}
                        disabled={memberBusyId === participantId}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-[#2a3942] text-[#e9edef] hover:bg-[#202c33] disabled:opacity-60"
                      >
                        {isUserAdmin(p._id) ? "Remove admin" : "Make admin"}
                      </button>
                      <button
                        onClick={() => handleRemoveParticipant(p)}
                        disabled={memberBusyId === participantId}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-[#8696a0] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300">{other?.email || "—"}</span>
          </div>
        )}
      </div>

      {/* Shared media */}
      {sharedMedia.length > 0 && (
        <div className="mt-2 bg-white dark:bg-[#1f2c33] px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Media</p>
            <span className="text-xs text-[#00a884] font-medium">{sharedMedia.length} photo{sharedMedia.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {sharedMedia.map((m) => (
              <div key={m._id}
                className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-pointer"
                onClick={() => window.open(resolveUrl(m.media.url), "_blank")}>
                <img src={resolveUrl(m.media.url)} alt="" className="w-full h-full object-cover hover:opacity-90 transition" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications */}
      <div className="mt-2 bg-white dark:bg-[#1f2c33] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-sm text-gray-900 dark:text-white">Notifications</span>
        </div>
        <button
          onClick={() => setNotifOn((v) => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${notifOn ? "bg-[#00a884]" : "bg-gray-300 dark:bg-gray-600"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${notifOn ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {/* Block user (1-on-1 only) */}
      {!isGroup && (
        <div className="mt-2 bg-white dark:bg-[#1f2c33] px-5 py-4">
          <button
            onClick={handleBlock}
            disabled={busy}
            className="flex items-center gap-3 w-full text-left group disabled:opacity-50"
          >
            <svg className={`w-5 h-5 transition ${blocked ? "text-red-500" : "text-[#8696a0] group-hover:text-red-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span className={`text-sm transition ${blocked ? "text-red-500 font-medium" : "text-gray-700 dark:text-gray-300 group-hover:text-red-500"}`}>
              {blocked ? `Unblock ${name}` : `Block ${name}`}
            </span>
          </button>
        </div>
      )}

      {/* Delete conversation */}
      <div className="mt-2 bg-white dark:bg-[#1f2c33] px-5 py-4 mb-4">
        <button
          onClick={handleDelete}
          disabled={busy}
          className="flex items-center gap-3 w-full text-left group disabled:opacity-50"
        >
          <svg className="w-5 h-5 text-red-400 group-hover:text-red-600 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-sm text-red-500 group-hover:text-red-600 transition font-medium">
            Delete conversation
          </span>
        </button>
      </div>

    </div>
  );
}
