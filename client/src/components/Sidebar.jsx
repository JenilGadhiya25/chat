import { useState, useEffect, useRef } from "react";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import api from "../lib/axios";
import Avatar from "./Avatar";
import SettingsModal from "./SettingsModal";
import CreateGroupModal from "./CreateGroupModal";
import { applyTheme, isDarkModeEnabled, subscribeTheme } from "../lib/theme";
export default function Sidebar({
  mainTab = "chats",
  aiOpen = false,
  onTabChange = () => {},
  onOpenAi = () => {},
  statusGroups = [],
  callLogs = [],
  groupConversations = [],
  onUpload = () => {},
  onViewStatus = () => {},
  onViewMyStatus = () => {},
}) {
  const {
    conversations, activeConversation, setActiveConversation,
    startConversation, onlineUsers,
    pinConversation, unpinConversation, archiveConversation, unarchiveConversation,
  } = useChatStore();
  const { user, logout } = useAuthStore();

  const [filterTab, setFilterTab] = useState("all");
  const [search, setSearch] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [darkMode, setDarkMode] = useState(() => isDarkModeEnabled());
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [showLogoutPanel, setShowLogoutPanel] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);
  const ctxRef = useRef(null);

  useEffect(() => {
    api.get("/users").then(({ data }) => setAllUsers(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (mainTab !== "chats" || !showAllUsers) return;
    const t = setTimeout(() => {
      api.get(`/users?search=${search}`).then(({ data }) => setAllUsers(data)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [search, mainTab, showAllUsers]);

  useEffect(() => subscribeTheme(setDarkMode), []);

  const toggleDark = () => {
    applyTheme(!darkMode);
  };

  useEffect(() => {
    const handler = (e) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openCtxMenu = (e, conv) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ conv, x: e.clientX, y: e.clientY });
  };

  const isPinned = (conv) => conv.pinnedBy?.some((id) => (id._id || id) === user?._id);
  const isArchived = (conv) => conv.archivedBy?.some((id) => (id._id || id) === user?._id);
  const getOther = (conv) => conv.participants?.find((p) => p._id !== user._id);
  const convName = (conv) => conv.isGroup ? conv.groupName : getOther(conv)?.username || "Unknown";
  const convAvatar = (conv) => conv.isGroup ? null : getOther(conv)?.avatar;
  const convOnline = (conv) => !conv.isGroup && onlineUsers.includes(getOther(conv)?._id);

  const fmt = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const diff = Date.now() - d;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 172800000) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const filteredConvs = conversations.filter((c) =>
    convName(c).toLowerCase().includes(search.toLowerCase())
  );

  const myStatusGroup = statusGroups.find((g) => g.user._id === user?._id);
  const otherStatusGroups = statusGroups.filter((g) => g.user._id !== user?._id);
  const titleByTab = {
    chats: "Chats",
    status: "Updates",
    calls: "Calls",
    communities: "Communities",
  };
  const panelBg = darkMode ? "bg-[#111b21]" : "bg-[#f8f9fb]";
  const mutedBg = darkMode ? "bg-[#202c33]" : "bg-[#ffffff]";
  const borderColor = darkMode ? "border-[#202c33]" : "border-gray-200";
  const textPrimary = darkMode ? "text-[#e9edef]" : "text-[#111b21]";
  const textMuted = darkMode ? "text-[#8696a0]" : "text-gray-500";
  const iconColor = darkMode ? "text-[#aebac1]" : "text-gray-600";
  const hoverBg = darkMode ? "hover:bg-white/10" : "hover:bg-black/5";
  const railBg = darkMode ? "bg-[#10161a]" : "bg-[#f6f7f9]";
  const railBorder = darkMode ? "border-[#1d2a31]" : "border-[#e6e9ef]";
  const railActive = darkMode ? "bg-[#1f2c33] text-[#00a884]" : "bg-[#dff3ee] text-[#008f72]";
  const railIdle = darkMode ? "text-[#8696a0] hover:bg-[#1c272d]" : "text-[#667781] hover:bg-[#eaedf1]";

  return (
    <aside className={`w-full sm:w-[390px] lg:w-[430px] flex ${panelBg} flex-shrink-0 h-full overflow-hidden`}>
      <div className={`w-[74px] ${railBg} border-r ${railBorder} flex flex-col items-center py-3`}>
        <button
          onClick={() => onTabChange("chats")}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition ${mainTab === "chats" ? railActive : railIdle}`}
          title="Chats"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
        </button>
        <button
          onClick={() => onTabChange("status")}
          className={`w-12 h-12 rounded-2xl mt-2 flex items-center justify-center transition ${mainTab === "status" ? railActive : railIdle}`}
          title="Updates"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" strokeWidth="2" />
          </svg>
        </button>
        <button
          onClick={() => onTabChange("communities")}
          className={`w-12 h-12 rounded-2xl mt-2 flex items-center justify-center transition ${mainTab === "communities" ? railActive : railIdle}`}
          title="Communities"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.98 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
        </button>
        <button
          onClick={() => onTabChange("calls")}
          className={`w-12 h-12 rounded-2xl mt-2 flex items-center justify-center transition ${mainTab === "calls" ? railActive : railIdle}`}
          title="Calls"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
        </button>
        <button
          onClick={onOpenAi}
          className={`w-12 h-12 rounded-2xl mt-2 flex items-center justify-center transition ${aiOpen ? railActive : railIdle}`}
          title="Ask Meta AI"
        >
          <div className="w-6 h-6 rounded-full border-[3px] border-[#2775ff] border-t-[#8a4bff] border-r-[#32d1ff]" />
        </button>

        <div className="mt-auto flex flex-col items-center gap-2">
          <button onClick={() => setShowSettings(true)}
            className={`w-11 h-11 rounded-full overflow-hidden border ${darkMode ? "border-[#30414a]" : "border-gray-200"} transition ${darkMode ? "hover:border-[#00a884]" : "hover:border-[#00a884]"}`}
            title="Profile">
            <Avatar src={user?.avatar} name={user?.username} size="sm" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 ${mutedBg} border-b ${borderColor}`}>
          <h1 className={`${textPrimary} font-semibold text-[28px] leading-none`}>
            {titleByTab[mainTab] || "Chats"}
          </h1>
          <div className="flex items-center gap-1 relative">
            <button onClick={() => { setShowMenu(false); setShowCreateGroup(true); }}
              className={`p-2 rounded-full ${hoverBg} ${iconColor}`} title="New group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => setShowAllUsers((prev) => !prev)}
              className={`p-2 rounded-full ${hoverBg} ${showAllUsers ? "text-[#00a884]" : iconColor}`}
              title="Toggle All users"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            <button onClick={() => setShowMenu((s) => !s)}
              className={`p-2 rounded-full ${hoverBg} ${iconColor}`} title="Menu">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 10a2 2 0 114 0 2 2 0 01-4 0zm-4 0a2 2 0 114 0 2 2 0 01-4 0zm8 0a2 2 0 114 0 2 2 0 01-4 0z" />
              </svg>
            </button>
            {showMenu && (
              <div className={`absolute top-10 right-0 w-48 ${mutedBg} shadow-xl rounded-lg z-50 py-1 border ${borderColor}`}>
                <button onClick={() => { setShowMenu(false); setShowSettings(true); }}
                  className={`w-full text-left px-4 py-2.5 text-sm ${textPrimary} ${darkMode ? "hover:bg-[#182229]" : "hover:bg-gray-100"}`}>Settings</button>
                <button onClick={() => { setShowMenu(false); toggleDark(); }}
                  className={`w-full text-left px-4 py-2.5 text-sm ${textPrimary} ${darkMode ? "hover:bg-[#182229]" : "hover:bg-gray-100"}`}>{darkMode ? "Light mode" : "Dark mode"}</button>
                <button onClick={() => { setShowMenu(false); setShowLogoutPanel(true); }}
                  className={`w-full text-left px-4 py-2.5 text-sm ${textPrimary} ${darkMode ? "hover:bg-[#182229]" : "hover:bg-gray-100"}`}>Log out</button>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className={`px-3 py-2 ${panelBg}`}>
          <div className={`flex items-center gap-2 ${mutedBg} rounded-xl px-3 py-2 border ${borderColor}`}>
            <svg className={`w-4 h-4 ${textMuted} flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or start a new chat" className={`flex-1 bg-transparent text-sm ${textPrimary} ${darkMode ? "placeholder-[#8696a0]" : "placeholder-gray-400"} focus:outline-none`} />
            {search && (
              <button onClick={() => setSearch("")} className={`${textMuted} ${darkMode ? "hover:text-white" : "hover:text-gray-800"}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* Filter pills */}
        {mainTab === "chats" && (
          <div className="flex gap-2 px-3 pb-2">
            {["all", "unread", "groups"].map((f) => (
              <button key={f} onClick={() => setFilterTab(f)}
                className={"px-3 py-1 rounded-full text-xs font-medium transition " + (filterTab === f ? "bg-[#00a884] text-white" : `${mutedBg} ${textMuted} ${darkMode ? "hover:bg-[#2a3942]" : "hover:bg-gray-100"} border ${borderColor}`)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">

        {/* CHATS TAB */}
        {mainTab === "chats" && (
          <>
            {/* Archived row */}
            {(() => {
              const archivedConvs = filteredConvs.filter((c) => isArchived(c));
              if (archivedConvs.length === 0) return null;
              return (
                <div onClick={() => setShowArchived(!showArchived)}
                  className={`flex items-center gap-3 px-4 py-3 border-b ${borderColor} cursor-pointer ${darkMode ? "hover:bg-[#202c33]" : "hover:bg-gray-100"} transition`}>
                  <div className={`w-12 h-12 rounded-full ${mutedBg} border ${borderColor} flex items-center justify-center flex-shrink-0`}>
                    <svg className="w-5 h-5 text-[#00a884]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </div>
                  <span className="text-[#00a884] font-medium text-[15px] flex-1">Archived</span>
                  <span className={`text-xs ${textMuted}`}>{archivedConvs.length}</span>
                  <svg className={`w-4 h-4 ${textMuted} transition-transform ` + (showArchived ? "rotate-180" : "")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              );
            })()}

            {/* Archived conversations expanded */}
            {showArchived && filteredConvs.filter((c) => isArchived(c)).map((conv) => (
              <ChatRow key={conv._id}
                isActive={activeConversation?._id === conv._id}
                onClick={() => setActiveConversation(conv)}
                onContextMenu={(e) => openCtxMenu(e, conv)}
                avatar={<AvatarRing src={convAvatar(conv)} name={convName(conv)} online={convOnline(conv)} isGroup={conv.isGroup} groupAvatar={conv.groupAvatar} darkMode={darkMode} />}
                darkMode={darkMode}
                name={convName(conv)}
                preview={conv.lastMessage?.text || (conv.lastMessage?.media?.url ? "Media" : "")}
                time={fmt(conv.updatedAt)}
                noMsg={!conv.lastMessage}
                pinned={isPinned(conv)}
              />
            ))}

            {/* Active conversations — pinned first */}
            {(() => {
              const active = filteredConvs
                .filter((c) => !isArchived(c))
                .filter((c) => filterTab === "groups" ? c.isGroup : true);
              const pinned = active.filter((c) => isPinned(c));
              const unpinned = active.filter((c) => !isPinned(c));
              return [...pinned, ...unpinned].map((conv) => (
                <ChatRow key={conv._id}
                  isActive={activeConversation?._id === conv._id}
                  onClick={() => setActiveConversation(conv)}
                  onContextMenu={(e) => openCtxMenu(e, conv)}
                  avatar={<AvatarRing src={convAvatar(conv)} name={convName(conv)} online={convOnline(conv)} isGroup={conv.isGroup} groupAvatar={conv.groupAvatar} darkMode={darkMode} />}
                  darkMode={darkMode}
                  name={convName(conv)}
                  preview={conv.lastMessage?.text || (conv.lastMessage?.media?.url ? "Media" : "")}
                  time={fmt(conv.updatedAt)}
                  noMsg={!conv.lastMessage}
                  pinned={isPinned(conv)}
                />
              ));
            })()}

            {/* All users */}
            {showAllUsers && (
              <>
                <div className="px-4 pt-4 pb-1">
                <p className={`text-xs ${textMuted} uppercase tracking-wider font-medium`}>All Users</p>
              </div>
                {allUsers.map((u) => (
                  <ChatRow key={u._id}
                    isActive={false}
                    onClick={() => startConversation(u._id)}
                    avatar={<AvatarRing src={u.avatar} name={u.username} online={onlineUsers.includes(u._id)} darkMode={darkMode} />}
                    darkMode={darkMode}
                    name={u.username}
                    preview={onlineUsers.includes(u._id) ? "online" : "Tap to chat"}
                    previewGreen={onlineUsers.includes(u._id)}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* STATUS TAB */}
        {mainTab === "status" && (
          <div className="p-3 space-y-1">
            <div className="px-1 pb-1">
              <p className={`text-xs ${textMuted} uppercase tracking-wider font-medium mb-2`}>My Status</p>
              <div className={`flex items-center gap-3 p-2 rounded-xl ${darkMode ? "hover:bg-[#202c33]" : "hover:bg-gray-100"} cursor-pointer transition`}
                onClick={myStatusGroup ? onViewMyStatus : onUpload}>
                <div className="relative flex-shrink-0">
                  <div className={"w-12 h-12 rounded-full overflow-hidden border-2 " + (myStatusGroup ? "border-[#00a884]" : "border-[#8696a0]")}>
                    <Avatar src={user?.avatar} name={user?.username} size="lg" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-5 h-5 bg-[#00a884] rounded-full flex items-center justify-center border-2 border-[#111b21]">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`${textPrimary} font-medium text-[15px]`}>My status</p>
                  <p className={`${textMuted} text-xs truncate`}>
                    {myStatusGroup ? myStatusGroup.items.length + " update" + (myStatusGroup.items.length > 1 ? "s" : "") : "Tap to add status update"}
                  </p>
                </div>
              </div>
            </div>

            {otherStatusGroups.length > 0 && (
              <div className="px-1">
                <p className={`text-xs ${textMuted} uppercase tracking-wider font-medium mb-2 mt-2`}>Recent Updates</p>
                {otherStatusGroups.map((group, idx) => {
                  const allViewed = group.items.every((s) => s.viewers?.some((v) => (v._id || v) === user?._id));
                  return (
                    <div key={group.user._id}
                      className={`flex items-center gap-3 p-2 rounded-xl ${darkMode ? "hover:bg-[#202c33]" : "hover:bg-gray-100"} cursor-pointer transition`}
                      onClick={() => onViewStatus(idx)}>
                      <div className="relative flex-shrink-0">
                        <div className={"w-12 h-12 rounded-full overflow-hidden border-2 " + (allViewed ? "border-[#8696a0]" : "border-[#00a884]")}>
                          <Avatar src={group.user.avatar} name={group.user.username} size="lg" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`${textPrimary} font-medium text-[15px] truncate`}>{group.user.username}</p>
                        <p className={`${textMuted} text-xs`}>
                          {fmt(group.items[0]?.createdAt)} · {group.items.length} update{group.items.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {otherStatusGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                <svg className={`w-16 h-16 ${textMuted} mb-3`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className={`${textMuted} text-sm`}>No status updates yet</p>
              </div>
            )}
          </div>
        )}

        {/* CALLS TAB */}
        {mainTab === "calls" && (
          <div className="p-3 space-y-1">
            {callLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-52 text-center px-6">
                <p className={`${textMuted} text-sm`}>No calls yet</p>
              </div>
            ) : (
              callLogs.map((log) => {
                const conv = log.conversationId;
                if (!conv) return null;
                const other = conv.isGroup ? null : conv.participants?.find((p) => p._id !== user?._id);
                const title = conv.isGroup ? conv.groupName : other?.username || "Unknown";
                return (
                  <ChatRow
                    key={log._id}
                    isActive={activeConversation?._id === conv._id}
                    onClick={() => setActiveConversation(conv)}
                    avatar={<AvatarRing src={conv.isGroup ? null : other?.avatar} name={title} online={false} isGroup={conv.isGroup} groupAvatar={conv.groupAvatar} darkMode={darkMode} />}
                    darkMode={darkMode}
                    name={title}
                    preview={`${log.callType === "video" ? "Video" : "Audio"} • ${log.status}`}
                    time={fmt(log.startedAt)}
                  />
                );
              })
            )}
          </div>
        )}

        {/* COMMUNITIES TAB */}
        {mainTab === "communities" && (
          <div className="p-3 space-y-1">
            {groupConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-52 text-center px-6">
                <p className={`${textMuted} text-sm`}>No communities yet</p>
              </div>
            ) : (
              groupConversations.map((conv) => (
                <ChatRow
                  key={conv._id}
                  isActive={activeConversation?._id === conv._id}
                  onClick={() => { setActiveConversation(conv); onTabChange("chats"); }}
                  avatar={<AvatarRing name={conv.groupName} online={false} isGroup groupAvatar={conv.groupAvatar} darkMode={darkMode} />}
                  darkMode={darkMode}
                  name={conv.groupName}
                  preview={`${conv.participants?.length || 0} members`}
                  time={fmt(conv.updatedAt)}
                />
              ))
            )}
          </div>
        )}

        </div>
      </div>

      {/* Modals */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      {showCreateGroup && <CreateGroupModal users={allUsers} onClose={() => setShowCreateGroup(false)} />}
      {showLogoutPanel && (
        <div className="fixed inset-0 z-[400] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl px-8 py-8 text-center">
            <div className="w-20 h-20 rounded-full bg-[#ef4444] mx-auto flex items-center justify-center mb-5">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
              </svg>
            </div>
            <h3 className="text-[46px] font-semibold text-gray-800 mb-2 leading-none">Logged Out</h3>
            <p className="text-gray-600 mb-7 text-xl">Your session will end. Please log in again.</p>
            <button
              onClick={() => { setShowLogoutPanel(false); logout(); }}
              className="w-full py-3 rounded-md bg-[#06b38e] text-white font-semibold text-lg hover:bg-[#059975] transition"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Right-click context menu */}
      {ctxMenu && (
        <div ref={ctxRef} className={`fixed z-[200] ${mutedBg} border ${borderColor} rounded-xl shadow-2xl py-1 w-48 text-sm`}
          style={{ top: ctxMenu.y, left: Math.min(ctxMenu.x, window.innerWidth - 200) }}>
          <button onClick={() => { isPinned(ctxMenu.conv) ? unpinConversation(ctxMenu.conv._id) : pinConversation(ctxMenu.conv._id); setCtxMenu(null); }}
            className={`w-full text-left px-4 py-2.5 ${textPrimary} ${darkMode ? "hover:bg-[#182229]" : "hover:bg-gray-100"} flex items-center gap-3`}>
            <svg className={`w-4 h-4 ${textMuted}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
            {isPinned(ctxMenu.conv) ? "Unpin chat" : "Pin chat"}
          </button>
          <button onClick={() => { isArchived(ctxMenu.conv) ? unarchiveConversation(ctxMenu.conv._id) : archiveConversation(ctxMenu.conv._id); setCtxMenu(null); }}
            className={`w-full text-left px-4 py-2.5 ${textPrimary} ${darkMode ? "hover:bg-[#182229]" : "hover:bg-gray-100"} flex items-center gap-3`}>
            <svg className={`w-4 h-4 ${textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            {isArchived(ctxMenu.conv) ? "Unarchive" : "Archive chat"}
          </button>
        </div>
      )}
    </aside>
  );
}

function ChatRow({ isActive, onClick, onContextMenu, avatar, name, preview, time, noMsg, previewGreen, pinned, darkMode }) {
  const rowHover = darkMode ? "hover:bg-[#202c33]" : "hover:bg-[#f2f4f7]";
  const rowActive = darkMode ? "bg-[#2a3942]" : "bg-[#e4e8ec]";
  const primary = darkMode ? "text-[#e9edef]" : "text-[#111b21]";
  const muted = darkMode ? "text-[#8696a0]" : "text-gray-500";
  return (
    <div onClick={onClick} onContextMenu={onContextMenu}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition select-none rounded-2xl mx-2 my-1 ` + (isActive ? rowActive : rowHover)}>
      <div className="flex-shrink-0">{avatar}</div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-1">
          <span className={`font-medium text-[15px] ${primary} truncate`}>{name}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {pinned && (
              <svg className={`w-3 h-3 ${muted}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
              </svg>
            )}
            {time && <span className={`text-[11px] ${muted}`}>{time}</span>}
          </div>
        </div>
        <p className={"text-[13px] truncate mt-0.5 " + (previewGreen ? "text-[#00a884]" : noMsg ? `${muted} italic` : muted)}>
          {preview || (noMsg ? "No messages yet" : "")}
        </p>
      </div>
    </div>
  );
}

function AvatarRing({ src, name, online, isGroup, groupAvatar, darkMode }) {
  const displaySrc = isGroup ? groupAvatar : src;
  return (
    <div className="relative">
      <div className={`w-12 h-12 rounded-full overflow-hidden ${darkMode ? "bg-[#2a3942]" : "bg-gray-200"} flex items-center justify-center`}>
        {displaySrc
          ? <Avatar src={displaySrc} name={name} size="lg" />
          : isGroup
            ? <svg className={`w-6 h-6 ${darkMode ? "text-[#8696a0]" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            : <Avatar src={src} name={name} size="lg" />
        }
      </div>
      {online && !isGroup && (
        <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#00a884] border-2 ${darkMode ? "border-[#111b21]" : "border-white"} rounded-full`} />
      )}
    </div>
  );
}
