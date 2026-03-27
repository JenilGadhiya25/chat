import { useEffect, useState, useCallback } from "react";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { connectSocket } from "../lib/socket";
import { requestNotificationPermission, showMessageNotification } from "../lib/notify.jsx";
import api from "../lib/axios";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import NoChatSelected from "../components/NoChatSelected";
import StatusPanel from "../components/StatusPanel";
import StatusUpload from "../components/StatusUpload";
import StatusViewer from "../components/StatusViewer";
import CallsPanel from "../components/CallsPanel";
import CommunitiesPanel from "../components/CommunitiesPanel";
import AiChatPanel from "../components/AiChatPanel";

export default function ChatPage() {
  const { user } = useAuthStore();
  const {
    fetchConversations,
    setOnlineUsers,
    receiveMessage,
    setTyping,
    clearTyping,
    updateEditedMessage,
    updateMessageReaction,
    activeConversation,
    callLogs,
    fetchCallLogs,
    conversations,
  } = useChatStore();

  // Lifted tab state — sidebar reads it, main panel reacts to it
  const [mainTab, setMainTab] = useState("chats");
  const [statusGroups, setStatusGroups] = useState([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [showAiChat, setShowAiChat] = useState(false);

  const fetchStatuses = useCallback(async () => {
    try {
      const { data } = await api.get("/status");
      setStatusGroups(data);
    } catch {}
  }, []);

  useEffect(() => {
    requestNotificationPermission();
    fetchConversations();
    fetchCallLogs();
    fetchStatuses();

    const socket = connectSocket(user._id);

    const handleOnlineUsers = (users) => setOnlineUsers(users);
    const handleNewMessage = (msg) => {
      receiveMessage(msg);

      // Notify only for messages from other users
      const senderId = msg?.sender?._id || msg?.sender;
      if (senderId?.toString() === user?._id?.toString()) return;

      const isActive = useChatStore.getState().activeConversation?._id === msg.conversationId;
      showMessageNotification(msg, isActive);
    };
    const handleTyping     = ({ conversationId, userId }) => setTyping(conversationId, userId);
    const handleStopTyping = ({ conversationId, userId }) => clearTyping(conversationId, userId);
    const handleEdited     = (msg) => updateEditedMessage(msg);
    const handleReaction   = (msg) => updateMessageReaction(msg);

    socket.on("onlineUsers",   handleOnlineUsers);
    socket.on("newMessage",    handleNewMessage);
    socket.on("typing",        handleTyping);
    socket.on("stopTyping",    handleStopTyping);
    socket.on("messageEdited", handleEdited);
    socket.on("messageReaction", handleReaction);

    return () => {
      socket.off("onlineUsers",   handleOnlineUsers);
      socket.off("newMessage",    handleNewMessage);
      socket.off("typing",        handleTyping);
      socket.off("stopTyping",    handleStopTyping);
      socket.off("messageEdited", handleEdited);
      socket.off("messageReaction", handleReaction);
    };
  }, []);

  const openViewer = (idx) => { setViewerStart(idx); setViewerOpen(true); };
  const markViewed = async (statusId) => {
    try { await api.post("/status/" + statusId + "/view"); } catch {}
  };
  const otherStatusGroups = statusGroups.filter((g) => g.user._id !== user?._id);
  const myGroup = statusGroups.find((g) => g.user._id === user?._id);

  // All groups for viewer — own first so index 0 = my status
  const allGroupsForViewer = [
    ...(myGroup ? [myGroup] : []),
    ...otherStatusGroups,
  ];

  const openMyStatus = () => {
    if (myGroup) {
      // Find index of my group in allGroupsForViewer (always 0 if present)
      setViewerStart(0);
      setViewerOpen(true);
    } else {
      setUploadOpen(true);
    }
  };

  const openOtherStatus = (idx) => {
    // idx is index in otherStatusGroups; offset by 1 if myGroup exists
    const offset = myGroup ? 1 : 0;
    setViewerStart(idx + offset);
    setViewerOpen(true);
  };

  useEffect(() => {
    if (activeConversation) setShowAiChat(false);
  }, [activeConversation]);

  const groupConversations = conversations.filter((c) => c.isGroup);
  const openAiPanel = () => {
    setMainTab("chats");
    useChatStore.setState({ activeConversation: null });
    setShowAiChat(true);
  };
  const isPrimaryChatWindowMounted = mainTab === "chats" && !!activeConversation && !showAiChat;
  const shouldMountBackgroundCallListener = !isPrimaryChatWindowMounted;

  return (
    <div className="h-screen w-screen bg-[#111b21]">
      <div className="flex h-full overflow-hidden bg-[#eceef1] dark:bg-[#111b21]">
        {/* Sidebar — always visible on desktop */}
        <div className={`${activeConversation && mainTab === "chats" ? "hidden sm:flex" : "flex"} w-full sm:w-[430px] flex-shrink-0 h-full`}>
          <Sidebar
            mainTab={mainTab}
            aiOpen={showAiChat}
            onTabChange={setMainTab}
            onOpenAi={openAiPanel}
            statusGroups={statusGroups}
            onUpload={() => setUploadOpen(true)}
            onViewStatus={openOtherStatus}
            onViewMyStatus={openMyStatus}
            callLogs={callLogs}
            groupConversations={groupConversations}
          />
        </div>

        {/* Main panel */}
        <main className={`${activeConversation && mainTab === "chats" ? "flex" : mainTab === "status" || mainTab === "calls" || mainTab === "communities" ? "flex" : "hidden sm:flex"} flex-1 flex-col min-w-0 h-full overflow-hidden`}>
          {mainTab === "status" ? (
            <StatusPanel
              statusGroups={statusGroups}
              onUpload={() => setUploadOpen(true)}
              onView={openOtherStatus}
              onViewMyStatus={openMyStatus}
            />
          ) : mainTab === "calls" ? (
            <CallsPanel callLogs={callLogs} />
          ) : mainTab === "communities" ? (
            <CommunitiesPanel groups={groupConversations} />
          ) : showAiChat ? (
            <AiChatPanel onClose={() => setShowAiChat(false)} />
          ) : activeConversation ? (
            <ChatWindow />
          ) : (
            <NoChatSelected onOpenAi={openAiPanel} />
          )}
        </main>
      </div>

      {/* Modals — rendered at page level so they overlay everything */}
      {uploadOpen && (
        <StatusUpload onClose={() => setUploadOpen(false)} onUploaded={fetchStatuses} />
      )}
      {viewerOpen && allGroupsForViewer.length > 0 && (
        <StatusViewer
          groups={allGroupsForViewer}
          startIndex={viewerStart}
          onClose={() => setViewerOpen(false)}
          onView={markViewed}
          onDeleted={fetchStatuses}
        />
      )}
      {shouldMountBackgroundCallListener && <ChatWindow listenerOnly />}
    </div>
  );
}
