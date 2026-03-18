import { useEffect } from "react";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { connectSocket, getSocket } from "../lib/socket";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import NoChatSelected from "../components/NoChatSelected";

export default function ChatPage() {
  const { user } = useAuthStore();
  const {
    fetchConversations,
    setOnlineUsers,
    receiveMessage,
    setTyping,
    clearTyping,
    updateEditedMessage,
    activeConversation,
    clearActiveConversation,
  } = useChatStore();

  useEffect(() => {
    fetchConversations();

    // Always ensure socket is connected (handles page refresh)
    const socket = connectSocket(user._id);

    const handleOnlineUsers = (users) => setOnlineUsers(users);
    const handleNewMessage = (msg) => {
      receiveMessage(msg);
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.4;
      audio.play().catch(() => {});
    };
    const handleTyping = ({ conversationId, userId }) => setTyping(conversationId, userId);
    const handleStopTyping = ({ conversationId, userId }) => clearTyping(conversationId, userId);
    const handleMessageEdited = (msg) => updateEditedMessage(msg);

    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("newMessage", handleNewMessage);
    socket.on("typing", handleTyping);
    socket.on("stopTyping", handleStopTyping);
    socket.on("messageEdited", handleMessageEdited);

    return () => {
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("newMessage", handleNewMessage);
      socket.off("typing", handleTyping);
      socket.off("stopTyping", handleStopTyping);
      socket.off("messageEdited", handleMessageEdited);
    };
  }, []);

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[var(--wa-app-bg)]">
      <div className="absolute top-0 left-0 right-0 h-32 bg-[var(--wa-topbar)]" />
      <div className="relative h-full p-0 md:p-4 lg:p-5">
        <div className="h-full max-w-[1500px] mx-auto flex bg-[var(--wa-shell)] shadow-[0_6px_24px_rgba(11,20,26,0.22)] border border-[var(--wa-border)]">
          <div className={`${activeConversation ? "hidden" : "flex"} md:flex h-full w-full md:w-auto`}>
            <Sidebar />
          </div>
          <main className={`${activeConversation ? "flex" : "hidden"} md:flex flex-1 flex-col min-w-0 h-full`}>
            {activeConversation ? <ChatWindow onBack={clearActiveConversation} /> : <NoChatSelected />}
          </main>
        </div>
      </div>
    </div>
  );
}
