import Avatar from "./Avatar";
import { useChatStore } from "../store/chatStore";

export default function CommunitiesPanel({ groups = [] }) {
  const { setActiveConversation } = useChatStore();

  return (
    <div className="flex-1 h-full bg-[#eef1f5] dark:bg-[#0b141a] overflow-y-auto">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-[#2a3942]">
        <h2 className="text-[#111b21] dark:text-[#e9edef] text-lg font-semibold">Communities</h2>
        <p className="text-xs mt-1 text-gray-500 dark:text-[#8696a0]">
          Your group spaces, announcements, and active discussions
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="h-[70%] flex items-center justify-center px-8 text-center">
          <div>
            <p className="text-lg font-medium text-[#111b21] dark:text-[#e9edef]">No communities yet</p>
            <p className="text-sm mt-2 text-gray-500 dark:text-[#8696a0]">
              Create a group from the chat menu to see it here.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
          {groups.map((g) => (
            <button
              key={g._id}
              onClick={() => setActiveConversation(g)}
              className="text-left rounded-2xl border border-gray-200 dark:border-[#2a3942] bg-white dark:bg-[#1f2c33] p-4 hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                <Avatar src={g.groupAvatar} name={g.groupName} size="lg" />
                <div className="min-w-0">
                  <p className="font-semibold text-[#111b21] dark:text-[#e9edef] truncate">{g.groupName || "Unnamed group"}</p>
                  <p className="text-xs text-gray-500 dark:text-[#8696a0]">
                    {g.participants?.length || 0} members
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-[#aebac1] min-h-[2.5rem]">
                {g.groupDescription || "No description yet."}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
