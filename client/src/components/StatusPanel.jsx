import { useAuthStore } from "../store/authStore";
import Avatar from "./Avatar";

// Right-panel shown when Status tab is active — matches the WhatsApp Web "Share status updates" screen
export default function StatusPanel({ statusGroups = [], onUpload, onView, onViewMyStatus }) {
  const { user } = useAuthStore();

  const myGroup = statusGroups.find((g) => g.user._id === user?._id);
  const others = statusGroups.filter((g) => g.user._id !== user?._id);

  const fmt = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const diff = Date.now() - d;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // If there are statuses to show, display them; otherwise show the empty state
  const hasContent = myGroup || others.length > 0;

  if (!hasContent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0b141a] h-full relative">
        {/* Icon */}
        <div className="mb-6 relative">
          <div className="w-20 h-20 rounded-full border-4 border-[#3d4a52] flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-4 border-[#3d4a52] flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-[#3d4a52]" />
            </div>
          </div>
        </div>

        <h2 className="text-[#e9edef] text-3xl font-light mb-3">Share status updates</h2>
        <p className="text-[#8696a0] text-sm text-center max-w-xs leading-relaxed">
          Share photos, videos and text that disappear after 24 hours.
        </p>

        <button
          onClick={onUpload}
          className="mt-8 px-6 py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-full text-sm font-medium transition"
        >
          Add status update
        </button>

        {/* Bottom encryption note */}
        <div className="absolute bottom-8 flex items-center gap-2 text-[#8696a0] text-xs">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Your status updates are end-to-end encrypted</span>
        </div>
      </div>
    );
  }

  // Has statuses — show a viewer-style list in the main panel
  return (
    <div className="flex-1 flex flex-col bg-[#0b141a] h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#2a3942]">
        <h2 className="text-[#e9edef] text-lg font-semibold">Status</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* My status */}
        <div>
          <p className="text-xs text-[#8696a0] uppercase tracking-wider font-medium mb-3 px-2">My Status</p>
          <div
            className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#202c33] cursor-pointer transition"
            onClick={myGroup ? onViewMyStatus : onUpload}
          >
            <div className="relative flex-shrink-0">
              <div className={`w-14 h-14 rounded-full overflow-hidden border-2 ${myGroup ? "border-[#00a884]" : "border-[#8696a0]"}`}>
                <Avatar src={user?.avatar} name={user?.username} size="lg" />
              </div>
              <div
                className="absolute bottom-0 right-0 w-5 h-5 bg-[#00a884] rounded-full flex items-center justify-center border-2 border-[#0b141a] cursor-pointer"
                onClick={(e) => { e.stopPropagation(); onUpload(); }}
                title="Add new status"
              >
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#e9edef] font-medium text-[15px]">My status</p>
              <p className="text-[#8696a0] text-xs mt-0.5">
                {myGroup
                  ? `${myGroup.items.length} update${myGroup.items.length > 1 ? "s" : ""} · ${fmt(myGroup.items[0]?.createdAt)}`
                  : "Tap to add status update"}
              </p>
            </div>
            {myGroup && (
              <svg className="w-4 h-4 text-[#8696a0] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        </div>

        {/* Recent updates */}
        {others.length > 0 && (
          <div>
            <p className="text-xs text-[#8696a0] uppercase tracking-wider font-medium mb-3 px-2">Recent Updates</p>
            <div className="space-y-1">
              {others.map((group, idx) => {
                const allViewed = group.items.every((s) =>
                  s.viewers?.some((v) => (v._id || v) === user?._id)
                );
                return (
                  <div
                    key={group.user._id}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#202c33] cursor-pointer transition"
                    onClick={() => onView(idx)}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-14 h-14 rounded-full overflow-hidden border-2 ${allViewed ? "border-[#8696a0]" : "border-[#00a884]"}`}>
                        <Avatar src={group.user.avatar} name={group.user.username} size="lg" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#e9edef] font-medium text-[15px] truncate">{group.user.username}</p>
                      <p className="text-[#8696a0] text-xs mt-0.5">
                        {fmt(group.items[0]?.createdAt)} · {group.items.length} update{group.items.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    {!allViewed && (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#00a884] flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom encryption note */}
      <div className="flex items-center justify-center gap-2 text-[#8696a0] text-xs py-4 border-t border-[#2a3942]">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Your status updates are end-to-end encrypted</span>
      </div>
    </div>
  );
}
