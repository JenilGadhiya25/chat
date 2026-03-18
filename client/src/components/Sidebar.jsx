import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import api from "../lib/axios";
import Avatar from "./Avatar";
import SettingsModal from "./SettingsModal";
import { formatDistanceToNow } from "date-fns";

export default function Sidebar() {
  const navigate = useNavigate();
  const { conversations, activeConversation, setActiveConversation, startConversation, onlineUsers } = useChatStore();
  const { user, logout } = useAuthStore();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem("darkMode") === "true");
  const [showSearch, setShowSearch] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAllUsersSection, setShowAllUsersSection] = useState(false);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("darkMode", next);
    document.documentElement.classList.toggle("dark", next);
  };

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await api.get(`/users?search=${search}`);
      setSearchResults(data);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        setLoadingUsers(true);
        const { data } = await api.get("/users");
        setAllUsers(data);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchAllUsers();
  }, []);

  const getOtherParticipant = (conv) =>
    conv.participants?.find((p) => p._id !== user._id);

  const getConvName = (conv) =>
    conv.isGroup ? conv.groupName : getOtherParticipant(conv)?.username || "Unknown";

  const getConvAvatar = (conv) =>
    conv.isGroup ? null : getOtherParticipant(conv)?.avatar;

  const isOnline = (conv) => {
    if (conv.isGroup) return false;
    const other = getOtherParticipant(conv);
    return onlineUsers.includes(other?._id);
  };

  return (
    <aside className="w-full md:w-[360px] flex flex-col border-r border-[var(--wa-border)] bg-[var(--wa-panel)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--wa-panel-muted)] border-b border-[var(--wa-border)]">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Avatar src={user?.avatar} name={user?.username} size="sm" />
            <button
              onClick={() => setShowSettings(true)}
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#00a884] text-white text-[10px] leading-none flex items-center justify-center shadow-sm"
              title="Change avatar/background"
            >
              ✎
            </button>
          </div>
          <span className="font-semibold text-[var(--wa-text)]">{user?.username}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSearch(!showSearch)} className="w-8 h-8 rounded-full hover:bg-[var(--wa-hover)] text-[var(--wa-subtext)]" title="Search users">
            ⌕
          </button>
          <button onClick={() => setShowSettings(true)} className="w-8 h-8 rounded-full hover:bg-[var(--wa-hover)] text-[var(--wa-subtext)]" title="Settings">
            ⚙
          </button>
          <button onClick={toggleDark} className="w-8 h-8 rounded-full hover:bg-[var(--wa-hover)] text-[var(--wa-subtext)]" title="Toggle dark mode">
            {darkMode ? "☼" : "☾"}
          </button>
          <button onClick={logout} className="w-8 h-8 rounded-full hover:bg-[var(--wa-hover)] text-[var(--wa-subtext)]" title="Logout">
            ⎋
          </button>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="px-3 py-2 bg-[var(--wa-panel)] border-b border-[var(--wa-border)]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full px-4 py-2 text-sm rounded-lg border border-[var(--wa-input-border)] bg-[var(--wa-panel-muted)] text-[var(--wa-text)] focus:outline-none focus:ring-2 focus:ring-[#00a884]/30"
          />
          {searchResults.length > 0 && (
            <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map((u) => (
                <li
                  key={u._id}
                  onClick={async () => {
                    await startConversation(u._id);
                    setSearch("");
                    setSearchResults([]);
                    setShowSearch(false);
                  }}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer hover:bg-[var(--wa-hover)]"
                >
                  <Avatar src={u.avatar} name={u.username} size="sm" />
                  <span className="text-sm text-[var(--wa-text)]">{u.username}</span>
                  {onlineUsers.includes(u._id) && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-green-500" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-2 border-b border-[var(--wa-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAllUsersSection((prev) => !prev)}
                className="w-6 h-6 rounded-full bg-[var(--wa-hover)] text-[var(--wa-subtext)] text-xs flex items-center justify-center hover:bg-[#00a884] hover:text-white"
                title={showAllUsersSection ? "Hide All Users" : "Show All Users"}
              >
                👥
              </button>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--wa-subtext)]">All users</p>
            </div>
            <button
              onClick={() => navigate("/all-users")}
              className="w-6 h-6 rounded-full bg-[var(--wa-hover)] text-[var(--wa-subtext)] text-xs flex items-center justify-center hover:bg-[#00a884] hover:text-white"
              title="Open All Users page"
            >
              ↗
            </button>
          </div>
          {showAllUsersSection && (
            <>
              {loadingUsers && <p className="text-xs text-[var(--wa-subtle)] mt-2">Loading users...</p>}
              {!loadingUsers && allUsers.length === 0 && (
                <p className="text-xs text-[var(--wa-subtle)] mt-2">No users found</p>
              )}
              {!loadingUsers && allUsers.length > 0 && (
                <ul className="mt-2 space-y-1 max-h-44 overflow-y-auto">
                  {allUsers.map((u) => (
                    <li
                      key={u._id}
                      onClick={async () => {
                        await startConversation(u._id);
                      }}
                      className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer hover:bg-[var(--wa-hover)]"
                    >
                      <Avatar src={u.avatar} name={u.username} size="sm" />
                      <span className="text-sm text-[var(--wa-text)] truncate">{u.username}</span>
                      {onlineUsers.includes(u._id) && (
                        <span className="ml-auto w-2 h-2 rounded-full bg-green-500" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--wa-subtext)]">
          Conversations
        </p>
        {conversations.length === 0 && (
          <p className="text-center text-sm text-[var(--wa-subtle)] mt-4">No conversations yet. Click any user above to start chatting.</p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv._id}
            onClick={() => setActiveConversation(conv)}
            className={`flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-[var(--wa-hover)] transition ${
              activeConversation?._id === conv._id ? "bg-[var(--wa-active)]" : ""
            }`}
          >
            <div className="relative flex-shrink-0">
              <Avatar src={getConvAvatar(conv)} name={getConvName(conv)} size="md" />
              {isOnline(conv) && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm text-[var(--wa-text)] truncate">{getConvName(conv)}</span>
                {conv.updatedAt && (
                  <span className="text-xs text-[var(--wa-subtle)] flex-shrink-0 ml-1">
                    {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: false })}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--wa-subtext)] truncate mt-0.5">
                {conv.lastMessage?.text || (conv.lastMessage?.media?.url ? "📎 Media" : "No messages yet")}
              </p>
            </div>
          </div>
        ))}
      </div>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </aside>
  );
}
