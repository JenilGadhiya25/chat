import { useMemo } from "react";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import Avatar from "./Avatar";

const statusColor = {
  completed: "text-[#00a884]",
  declined: "text-orange-500",
  missed: "text-red-500",
  cancelled: "text-gray-500",
};

const statusLabel = {
  completed: "Completed",
  declined: "Declined",
  missed: "Missed",
  cancelled: "Cancelled",
};

const formatDuration = (sec) => {
  const s = Math.max(0, Number(sec || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  return `${mm}:${ss}`;
};

export default function CallsPanel({ callLogs = [] }) {
  const { user } = useAuthStore();
  const { setActiveConversation } = useChatStore();

  const normalized = useMemo(() => {
    return callLogs.map((log) => {
      const conv = log.conversationId;
      if (!conv) return null;
      const other = conv.isGroup
        ? null
        : conv.participants?.find((p) => p._id !== user?._id);
      return {
        ...log,
        conv,
        title: conv.isGroup ? conv.groupName || "Group call" : other?.username || "Unknown user",
        avatar: conv.isGroup ? conv.groupAvatar : other?.avatar,
        when: new Date(log.startedAt),
      };
    }).filter(Boolean);
  }, [callLogs, user?._id]);

  return (
    <div className="flex-1 h-full bg-[#f0f2f5] dark:bg-[#0b141a] overflow-y-auto">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-[#2a3942]">
        <h2 className="text-[#111b21] dark:text-[#e9edef] text-lg font-semibold">Calls</h2>
        <p className="text-xs mt-1 text-gray-500 dark:text-[#8696a0]">Recent audio and video calls</p>
      </div>

      {normalized.length === 0 ? (
        <div className="h-[70%] flex items-center justify-center px-8 text-center">
          <div>
            <p className="text-lg font-medium text-[#111b21] dark:text-[#e9edef]">No calls yet</p>
            <p className="text-sm mt-2 text-gray-500 dark:text-[#8696a0]">Start a call from any one-to-one chat and it will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          {normalized.map((log) => (
            <button
              key={log._id}
              onClick={() => setActiveConversation(log.conv)}
              className="w-full flex items-center gap-3 text-left rounded-2xl px-3 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <Avatar src={log.avatar} name={log.title} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#111b21] dark:text-[#e9edef] truncate">{log.title}</p>
                <p className="text-xs text-gray-500 dark:text-[#8696a0] mt-0.5">
                  {log.when.toLocaleDateString("en-US", { month: "short", day: "numeric" })} •{" "}
                  {log.when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-xs font-semibold ${statusColor[log.status] || "text-gray-500"}`}>
                  {statusLabel[log.status] || "Call"}
                </p>
                <p className="text-xs text-gray-500 dark:text-[#8696a0] mt-0.5">
                  {log.callType === "video" ? "Video" : "Audio"} • {formatDuration(log.durationSec)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
