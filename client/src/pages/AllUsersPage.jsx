import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/axios";
import Avatar from "../components/Avatar";
import { useChatStore } from "../store/chatStore";

export default function AllUsersPage() {
  const navigate = useNavigate();
  const { startConversation } = useChatStore();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
        const { data } = await api.get(`/users${query}`);
        setUsers(data);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchUsers, 200);
    return () => clearTimeout(timer);
  }, [search]);

  const handleStartChat = async (userId) => {
    await startConversation(userId);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[var(--wa-app-bg)] p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-[var(--wa-panel)] border border-[var(--wa-border)] rounded-xl overflow-hidden shadow-lg">
        <div className="px-4 py-3 bg-[var(--wa-panel-muted)] border-b border-[var(--wa-border)] flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[var(--wa-text)]">All Users</h1>
          <button
            onClick={() => navigate("/")}
            className="px-3 py-1.5 rounded-lg text-sm bg-[var(--wa-hover)] text-[var(--wa-subtext)]"
          >
            Back
          </button>
        </div>

        <div className="p-4 border-b border-[var(--wa-border)]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full px-4 py-2 rounded-lg border border-[var(--wa-input-border)] bg-[var(--wa-input-bg)] text-[var(--wa-text)] focus:outline-none focus:ring-2 focus:ring-[#00a884]/25"
          />
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {loading && <p className="p-4 text-sm text-[var(--wa-subtle)]">Loading users...</p>}
          {!loading && users.length === 0 && <p className="p-4 text-sm text-[var(--wa-subtle)]">No users found.</p>}
          {users.map((u) => (
            <button
              key={u._id}
              onClick={() => handleStartChat(u._id)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left border-b border-[var(--wa-border)] hover:bg-[var(--wa-hover)]"
            >
              <Avatar src={u.avatar} name={u.username} size="md" />
              <div>
                <p className="text-sm font-medium text-[var(--wa-text)]">{u.username}</p>
                <p className="text-xs text-[var(--wa-subtext)]">{u.email}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
