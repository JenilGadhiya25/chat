import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { getSocket } from "../lib/socket";
import { SERVER_URL } from "../lib/axios";
import MessageBubble from "./MessageBubble";
import Avatar from "./Avatar";
import EmojiPicker from "emoji-picker-react";
import ContactInfoPanel from "./ContactInfoPanel";
import { isDarkModeEnabled, subscribeTheme } from "../lib/theme";
import toast from "react-hot-toast";

const ICE_SERVERS = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

const resolveBg = (bg) => {
  if (!bg) return null;
  if (bg.startsWith("color:")) return { type: "css", value: bg.slice(6) };
  if (bg.startsWith("linear-gradient") || bg.startsWith("#")) return { type: "css", value: bg };
  if (bg.startsWith("http") || bg.startsWith("/presets/")) return { type: "img", value: bg };
  return { type: "img", value: `${SERVER_URL}${bg}` };
};

const resolveAvatar = (src) => {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("/presets/")) return src;
  return `${SERVER_URL}${src}`;
};

export default function ChatWindow() {
  const { activeConversation, messages, loading, sendMessage, typingUsers, onlineUsers, logCall } = useChatStore();
  const { user } = useAuthStore();

  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [enterSend, setEnterSend] = useState(() => {
    const raw = localStorage.getItem("settings_enter_send");
    return raw === null ? true : raw === "true";
  });
  const [isDark, setIsDark] = useState(() => isDarkModeEnabled());
  const [showInfo, setShowInfo] = useState(false);

  const [callState, setCallState] = useState("idle"); // idle | calling | ringing | in-call
  const [callType, setCallType] = useState("audio"); // audio | video
  const [incomingCall, setIncomingCall] = useState(null);
  const [activePeer, setActivePeer] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);

  const pcRef = useRef(null);
  const callMetaRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);

  const chatBg = resolveBg(user?.chatBackground);
  const otherParticipant = activeConversation?.isGroup
    ? null
    : activeConversation?.participants?.find((p) => p._id !== user._id);
  const isOtherOnline = otherParticipant && onlineUsers.includes(otherParticipant._id);

  const convTyping = typingUsers[activeConversation?._id] || [];
  const isTyping = convTyping.some((id) => id !== user._id);

  const convName = activeConversation?.isGroup
    ? activeConversation.groupName
    : otherParticipant?.username || "Unknown";
  const convAvatar = activeConversation?.isGroup
    ? activeConversation?.groupAvatar
    : otherParticipant?.avatar;

  const toDayKey = (value) => {
    const d = new Date(value);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  const formatDayHeader = (value) => {
    const d = new Date(value);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) return "Today";
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
    });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => subscribeTheme(setIsDark), []);

  useEffect(() => {
    const sync = () => {
      const raw = localStorage.getItem("settings_enter_send");
      setEnterSend(raw === null ? true : raw === "true");
    };
    window.addEventListener("app-settings-updated", sync);
    return () => window.removeEventListener("app-settings-updated", sync);
  }, []);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream]);

  const clearPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.close();
      pcRef.current = null;
    }
  }, []);

  const stopStream = (stream) => {
    stream?.getTracks?.().forEach((track) => track.stop());
  };

  const endLocalCallState = useCallback(() => {
    clearPeerConnection();
    stopStream(localStream);
    stopStream(remoteStream);
    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
    setActivePeer(null);
    setIsMicMuted(false);
    setIsCamOff(false);
    setCallState("idle");
  }, [clearPeerConnection, localStream, remoteStream]);

  const persistCallLog = useCallback(async (status) => {
    const meta = callMetaRef.current;
    if (!meta || meta.logged || !meta.conversationId) return;
    meta.logged = true;
    const started = meta.startedAt ? new Date(meta.startedAt) : new Date();
    const ended = new Date();
    const durationSec = Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000));
    try {
      await logCall(meta.conversationId, {
        callType: meta.callType,
        status,
        startedAt: started.toISOString(),
        endedAt: ended.toISOString(),
        durationSec,
      });
    } catch {
      // Keep call UX uninterrupted if logging fails
    } finally {
      callMetaRef.current = null;
    }
  }, [logCall]);

  const createPeerConnection = useCallback((targetUserId) => {
    const socket = getSocket();
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (!event.candidate || !socket) return;
      socket.emit("call:ice", {
        toUserId: targetUserId,
        payload: {
          candidate: event.candidate,
          conversationId: activeConversation?._id,
        },
      });
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) setRemoteStream(stream);
    };

    pcRef.current = pc;
    return pc;
  }, [activeConversation?._id]);

  const emitTyping = useCallback(() => {
    if (!activeConversation?._id) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit("typing", { conversationId: activeConversation._id, userId: user._id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("stopTyping", { conversationId: activeConversation._id, userId: user._id });
    }, 1500);
  }, [activeConversation?._id, user?._id]);

  const handleTextChange = (e) => {
    setText(e.target.value);
    emitTyping();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMediaFile(file);
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      setMediaPreview(URL.createObjectURL(file));
    } else {
      setMediaPreview(null);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() && !mediaFile) return;
    setSending(true);
    try {
      await sendMessage(activeConversation._id, text.trim(), mediaFile);
      setText("");
      setMediaFile(null);
      setMediaPreview(null);
      setShowEmoji(false);
      const socket = getSocket();
      socket?.emit("stopTyping", { conversationId: activeConversation._id, userId: user._id });
    } finally {
      setSending(false);
    }
  };

  const onEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const startCall = async (type) => {
    if (!otherParticipant || activeConversation?.isGroup) {
      toast.error("Calls are available for 1:1 chats only");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });

      setCallType(type);
      setLocalStream(stream);
      setRemoteStream(null);
      setActivePeer({
        userId: otherParticipant._id,
        username: otherParticipant.username,
        avatar: otherParticipant.avatar,
      });
      setCallState("calling");
      callMetaRef.current = {
        conversationId: activeConversation?._id,
        callType: type,
        startedAt: Date.now(),
        logged: false,
      };

      const pc = createPeerConnection(otherParticipant._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const socket = getSocket();
      socket?.emit("call:offer", {
        toUserId: otherParticipant._id,
        payload: {
          sdp: offer,
          callType: type,
          conversationId: activeConversation?._id,
          fromName: user?.username,
          fromAvatar: user?.avatar,
        },
      });
    } catch {
      toast.error("Could not start call. Please allow microphone/camera access.");
      endLocalCallState();
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;

    try {
      const wantsVideo = incomingCall.callType === "video";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantsVideo,
      });

      setCallType(incomingCall.callType);
      setLocalStream(stream);
      setRemoteStream(null);
      setActivePeer({
        userId: incomingCall.fromUserId,
        username: incomingCall.fromName,
        avatar: incomingCall.fromAvatar,
      });

      const pc = createPeerConnection(incomingCall.fromUserId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const socket = getSocket();
      socket?.emit("call:answer", {
        toUserId: incomingCall.fromUserId,
        payload: {
          sdp: answer,
          conversationId: incomingCall.conversationId,
        },
      });

      setIncomingCall(null);
      setCallState("in-call");
    } catch {
      toast.error("Could not answer call.");
      endLocalCallState();
    }
  };

  const declineIncomingCall = () => {
    if (!incomingCall) return;
    const socket = getSocket();
    socket?.emit("call:end", {
      toUserId: incomingCall.fromUserId,
      payload: { reason: "declined", conversationId: incomingCall.conversationId },
    });
    setIncomingCall(null);
    setCallState("idle");
  };

  const hangupCall = () => {
    if (activePeer?.userId) {
      const socket = getSocket();
      socket?.emit("call:end", {
        toUserId: activePeer.userId,
        payload: { reason: "ended", conversationId: activeConversation?._id },
      });
    }
    persistCallLog(callState === "in-call" ? "completed" : "cancelled");
    endLocalCallState();
  };

  const toggleMute = () => {
    if (!localStream) return;
    const next = !isMicMuted;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setIsMicMuted(next);
  };

  const toggleCamera = () => {
    if (!localStream) return;
    const next = !isCamOff;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    setIsCamOff(next);
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onOffer = (payload) => {
      if (callState !== "idle") {
        socket.emit("call:end", {
          toUserId: payload.fromUserId,
          payload: { reason: "busy", conversationId: payload.conversationId },
        });
        return;
      }

      setIncomingCall({
        fromUserId: payload.fromUserId,
        fromName: payload.fromName || "Unknown",
        fromAvatar: payload.fromAvatar || "",
        sdp: payload.sdp,
        callType: payload.callType || "audio",
        conversationId: payload.conversationId,
      });
      setCallType(payload.callType || "audio");
      setCallState("ringing");
    };

    const onAnswer = async (payload) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        setCallState("in-call");
      } catch {
        toast.error("Call connection failed");
        endLocalCallState();
      }
    };

    const onIce = async (payload) => {
      if (!pcRef.current || !payload?.candidate) return;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // Ignore invalid ICE candidates
      }
    };

    const onEnd = (payload) => {
      if (payload?.reason === "busy") toast.error("User is busy on another call");
      if (payload?.reason === "declined") toast.error("Call was declined");
      if (payload?.reason !== "busy" && payload?.reason !== "declined") {
        toast("Call ended");
      }
      if (payload?.reason === "busy") persistCallLog("missed");
      else if (payload?.reason === "declined") persistCallLog("declined");
      else persistCallLog(callState === "in-call" ? "completed" : "cancelled");
      endLocalCallState();
    };

    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice", onIce);
    socket.on("call:end", onEnd);

    return () => {
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice", onIce);
      socket.off("call:end", onEnd);
    };
  }, [callState, endLocalCallState, persistCallLog]);

  useEffect(() => {
    return () => {
      endLocalCallState();
    };
  }, [endLocalCallState]);

  return (
    <div className="flex h-full min-w-0 relative">
      <div className="flex flex-col flex-1 min-w-0 bg-[#efeae2] dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f0f2f5] dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <button
            className="sm:hidden p-1 -ml-1 text-gray-500 dark:text-gray-400"
            onClick={() => useChatStore.setState({ activeConversation: null })}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setShowInfo((v) => !v)}>
            <div className="relative flex-shrink-0">
              <Avatar src={convAvatar} name={convName} size="md" />
              {isOtherOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white text-[15px] truncate">{convName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isTyping ? (
                  <span className="text-[#00a884]">typing...</span>
                ) : isOtherOnline ? (
                  "online"
                ) : otherParticipant?.lastSeen ? (
                  `last seen ${new Date(otherParticipant.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                ) : (
                  "offline"
                )}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => startCall("audio")}
              disabled={!otherParticipant || activeConversation?.isGroup || callState !== "idle"}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-50"
              title="Voice call"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </button>
            <button
              onClick={() => startCall("video")}
              disabled={!otherParticipant || activeConversation?.isGroup || callState !== "idle"}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-50"
              title="Video call"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            </button>
            <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div
          className="flex-1 overflow-y-auto px-4 sm:px-10 py-4 space-y-1"
          style={
            chatBg?.type === "img"
              ? { backgroundImage: `url('${chatBg.value}')`, backgroundSize: "cover", backgroundPosition: "center" }
              : chatBg?.type === "css"
              ? { background: chatBg.value }
              : {
                  backgroundImage: isDark
                    ? "url('data:image/svg+xml,%3Csvg width=\"40\" height=\"40\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M0 0h40v40H0z\" fill=\"%23111827\"/%3E%3Cpath d=\"M20 0L0 20M40 0L20 20M40 20L20 40M20 20L0 40\" stroke=\"%231f2937\" stroke-width=\"0.5\" opacity=\"0.1\"/%3E%3C/svg%3E')"
                    : "url('data:image/svg+xml,%3Csvg width=\"40\" height=\"40\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M0 0h40v40H0z\" fill=\"%23efeae2\"/%3E%3Cpath d=\"M20 0L0 20M40 0L20 20M40 20L20 40M20 20L0 40\" stroke=\"%23d1d7db\" stroke-width=\"0.5\" opacity=\"0.3\"/%3E%3C/svg%3E')",
                }
          }
        >
          <div className="w-full flex justify-center pt-2">
            <div className="max-w-[680px] w-full bg-[#f6e5d1] text-[#4d5b66] rounded-2xl px-4 py-3 text-sm flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 8V6a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V6a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Messages are end-to-end encrypted. No one outside of this chat can read or listen to them.</span>
            </div>
          </div>

          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {messages.map((msg, idx) => {
            const currentKey = toDayKey(msg.createdAt);
            const prevKey = idx > 0 ? toDayKey(messages[idx - 1].createdAt) : null;
            const showHeader = idx === 0 || currentKey !== prevKey;
            return (
              <div key={msg._id}>
                {showHeader && (
                  <div className="w-full flex justify-center mt-4 mb-2">
                    <span className="px-5 py-2 rounded-xl bg-white/70 border border-gray-200 text-[#65747f] text-sm font-medium">
                      {formatDayHeader(msg.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble message={msg} isOwn={msg.sender._id === user._id || msg.sender === user._id} />
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-end gap-2">
              <div className="bg-white dark:bg-gray-700 rounded-lg rounded-bl-sm px-4 py-2.5 shadow-sm">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Media preview */}
        {mediaPreview && (
          <div className="px-4 py-2 bg-[#f0f2f5] dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="relative inline-block">
              {mediaFile?.type.startsWith("image/") ? (
                <img src={mediaPreview} alt="preview" className="h-20 rounded-lg object-cover" />
              ) : (
                <video src={mediaPreview} className="h-20 rounded-lg" />
              )}
              <button
                onClick={() => {
                  setMediaFile(null);
                  setMediaPreview(null);
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm flex items-center justify-center hover:bg-red-600"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {mediaFile && !mediaPreview && (
          <div className="px-4 py-2 bg-[#f0f2f5] dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{mediaFile.name}</span>
            <button onClick={() => setMediaFile(null)} className="text-red-500 text-sm hover:text-red-600">Remove</button>
          </div>
        )}

        {/* Input area */}
        <form
          onSubmit={handleSend}
          className={`flex items-center gap-2 px-4 py-2.5 relative ${isDark ? "bg-[#1f2c33]" : "bg-[#e9edef]"}`}
        >
          {showEmoji && (
            <div className="absolute bottom-16 left-4 z-50">
              <EmojiPicker
                onEmojiClick={onEmojiClick}
                theme={document.documentElement.classList.contains("dark") ? "dark" : "light"}
                height={400}
                width={350}
              />
            </div>
          )}

          <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" />
            </svg>
          </button>

          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />

          <input
            type="text"
            value={text}
            onChange={handleTextChange}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (!enterSend) return;
              if (e.shiftKey) return;
              handleSend(e);
            }}
            placeholder="Type a message"
            className={`flex-1 px-4 py-3 rounded-2xl focus:outline-none text-[15px] ${
              isDark
                ? "bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0]"
                : "bg-white text-gray-900 placeholder-gray-500"
            }`}
          />

          <button
            type="submit"
            disabled={sending || (!text.trim() && !mediaFile)}
            className="w-12 h-12 bg-[#1f8f7a] hover:bg-[#197b68] text-white rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 -rotate-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21.43 2.57a1 1 0 00-1.03-.24l-17 6a1 1 0 00-.05 1.87l7.14 2.63 2.63 7.14a1 1 0 00.93.65h.03a1 1 0 00.92-.72l6-17a1 1 0 00-.57-1.33z" />
              </svg>
            )}
          </button>
        </form>
      </div>

      {showInfo && <ContactInfoPanel onClose={() => setShowInfo(false)} />}

      {(callState !== "idle" || incomingCall) && (
        <CallOverlay
          callState={callState}
          callType={callType}
          incomingCall={incomingCall}
          peer={activePeer}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          localStream={localStream}
          remoteStream={remoteStream}
          onAccept={acceptIncomingCall}
          onDecline={declineIncomingCall}
          onHangup={hangupCall}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          isMicMuted={isMicMuted}
          isCamOff={isCamOff}
        />
      )}
    </div>
  );
}

function CallOverlay({
  callState,
  callType,
  incomingCall,
  peer,
  localVideoRef,
  remoteVideoRef,
  localStream,
  remoteStream,
  onAccept,
  onDecline,
  onHangup,
  onToggleMute,
  onToggleCamera,
  isMicMuted,
  isCamOff,
}) {
  const caller = incomingCall || peer;
  const name = caller?.fromName || caller?.username || "Unknown";
  const avatar = resolveAvatar(caller?.fromAvatar || caller?.avatar);
  const isVideo = callType === "video";
  const showIncoming = callState === "ringing" && incomingCall;
  const showRemoteVideo = isVideo && remoteStream && !showIncoming;
  const showLocalVideo = isVideo && localStream && !showIncoming && !isCamOff;

  return (
    <div className="fixed inset-0 z-[250] bg-[#040712]">
      <div className="relative w-full h-full overflow-hidden bg-[#050817]">
        {showRemoteVideo && (
          <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
        )}

        {!showRemoteVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="w-28 h-28 rounded-full overflow-hidden bg-[#b8bfd1] mb-4 flex items-center justify-center">
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl text-white font-semibold">{name?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <p className="text-[#d9dbe3] text-[44px] font-medium leading-none">{name}</p>
            <p className="text-[#8f95a6] mt-2 text-base">
              {showIncoming
                ? `Incoming ${isVideo ? "video" : "voice"} call`
                : callState === "calling"
                ? "calling..."
                : "in call"}
            </p>
          </div>
        )}

        {showLocalVideo && (
          <div className="absolute top-6 left-6 w-56 h-36 rounded-2xl overflow-hidden border border-white/20 bg-black/30">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          </div>
        )}

        {!showIncoming && (
          <button
            onClick={onHangup}
            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-[#e3e8f3] text-[#61697f] flex items-center justify-center hover:bg-white"
            title="Close call"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>
        )}

        {!showIncoming && (
          <>
            <button className="absolute left-8 bottom-8 w-12 h-12 rounded-full bg-[#e3e8f3] text-[#61697f] flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z" />
              </svg>
            </button>
            <button className="absolute right-8 bottom-8 w-12 h-12 rounded-full bg-[#e3e8f3] text-[#61697f] flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </>
        )}

        {showIncoming ? (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <button onClick={onDecline} className="px-7 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium">
              Decline
            </button>
            <button onClick={onAccept} className="px-7 py-3 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white font-medium">
              Accept
            </button>
          </div>
        ) : (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
            {isVideo && (
              <button
                onClick={onToggleCamera}
                className={`w-14 h-14 rounded-full flex items-center justify-center ${isCamOff ? "bg-[#2b3142] text-white" : "bg-[#f3f5fa] text-[#61697f]"}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m-9 5h8a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            <button
              onClick={onToggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center ${isMicMuted ? "bg-[#2b3142] text-white" : "bg-[#f3f5fa] text-[#61697f]"}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v11m0 0a3 3 0 003-3V6a3 3 0 10-6 0v3a3 3 0 003 3zm0 0v4m-4 0h8M5 10v1a7 7 0 0014 0v-1" />
              </svg>
            </button>
            <button onClick={onHangup} className="w-16 h-16 rounded-full bg-[#e53935] hover:bg-[#d32f2f] text-white flex items-center justify-center">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 15.46l-5.27-.61a1 1 0 00-.93.28l-2.29 2.29a15.09 15.09 0 01-6.12-6.12l2.29-2.29a1 1 0 00.28-.93L8.54 3a1 1 0 00-.99-.84H3a1 1 0 00-1 1C2 13.94 10.06 22 20.84 22a1 1 0 001-1v-4.55a1 1 0 00-.84-.99z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
