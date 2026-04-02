import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { getSocket } from "../lib/socket";
import { resolveMediaUrl } from "../lib/mediaUrl";
import MessageBubble from "./MessageBubble";
import Avatar from "./Avatar";
import EmojiPicker from "emoji-picker-react";
import ContactInfoPanel from "./ContactInfoPanel";
import { isDarkModeEnabled, subscribeTheme } from "../lib/theme";
import toast from "react-hot-toast";

const DEFAULT_ICE = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

const parseIceServers = () => {
  const raw = import.meta.env.VITE_ICE_SERVERS_JSON;
  if (!raw) return DEFAULT_ICE;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ICE;
  } catch {
    return DEFAULT_ICE;
  }
};

const ICE_SERVERS = { iceServers: parseIceServers() };
const CALL_RING_TIMEOUT_MS = Number(import.meta.env.VITE_CALL_RING_TIMEOUT_MS || 30000);

const resolveBg = (bg) => {
  if (!bg) return null;
  if (bg.startsWith("color:")) return { type: "css", value: bg.slice(6) };
  if (bg.startsWith("linear-gradient") || bg.startsWith("#")) return { type: "css", value: bg };
  return { type: "img", value: resolveMediaUrl(bg) };
};

const resolveAvatar = (src) => {
  if (!src) return "";
  return resolveMediaUrl(src);
};

const normalizeSdpPayload = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed;
      return null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    if (value.type && value.sdp) return value;
    if (value.description?.type && value.description?.sdp) return value.description;
    if (value.offer?.type && value.offer?.sdp) return value.offer;
    if (value.answer?.type && value.answer?.sdp) return value.answer;
    return value;
  }
  return null;
};

export default function ChatWindow({ listenerOnly = false }) {
  const {
    activeConversation,
    conversations,
    messages,
    loading,
    sendMessage,
    typingUsers,
    onlineUsers,
    logCall,
    setActiveConversation,
  } = useChatStore();
  const { user } = useAuthStore();

  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // message being replied to
  const [forwardMsg, setForwardMsg] = useState(null); // message being forwarded
  const [enterSend, setEnterSend] = useState(() => {
    const raw = localStorage.getItem("settings_enter_send");
    return raw === null ? true : raw === "true";
  });
  const [isDark, setIsDark] = useState(() => isDarkModeEnabled());
  const [showInfo, setShowInfo] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef(null);
  const attachMenuRef = useRef(null);
  const photoVideoRef = useRef(null);
  const documentRef = useRef(null);
  const audioRef = useRef(null);

  const [callState, setCallState] = useState("idle"); // idle | calling | ringing | in-call
  const [callType, setCallType] = useState("audio"); // audio | video
  const [incomingCall, setIncomingCall] = useState(null);
  const [activePeer, setActivePeer] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState([]);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);

  const pcMapRef = useRef(new Map());
  const peerMetaRef = useRef(new Map());
  const callMetaRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const isAnsweringRef = useRef(false);

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
  const groupTargets = (activeConversation?.participants || []).filter((p) => p._id !== user?._id);

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

  // Close chat menu on outside click
  useEffect(() => {
    if (!showChatMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowChatMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showChatMenu]);

  // Close attach menu on outside click
  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = (e) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) setShowAttachMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAttachMenu]);

  useEffect(() => {
    const sync = () => {
      const raw = localStorage.getItem("settings_enter_send");
      setEnterSend(raw === null ? true : raw === "true");
    };
    window.addEventListener("app-settings-updated", sync);
    return () => window.removeEventListener("app-settings-updated", sync);
  }, []);

  useEffect(() => {
    localStreamRef.current = localStream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
    }
  }, [localStream]);

  useEffect(() => {
    remoteStreamRef.current = remoteStream;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream]);

  const clearPeerConnection = useCallback((userId) => {
    const pc = pcMapRef.current.get(userId);
    if (!pc) return;
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.close();
    pcMapRef.current.delete(userId);
    peerMetaRef.current.delete(userId);
  }, []);

  const clearAllPeerConnections = useCallback(() => {
    [...pcMapRef.current.keys()].forEach((uid) => clearPeerConnection(uid));
    pcMapRef.current.clear();
    peerMetaRef.current.clear();
  }, [clearPeerConnection]);

  const upsertRemotePeer = useCallback((userId, stream, meta = {}) => {
    if (!userId || !stream) return;
    setRemotePeers((prev) => {
      const idx = prev.findIndex((p) => p.userId === userId);
      const nextPeer = {
        userId,
        stream,
        username: meta.username || prev[idx]?.username || "Unknown",
        avatar: meta.avatar || prev[idx]?.avatar || "",
      };
      if (idx === -1) return [...prev, nextPeer];
      const clone = [...prev];
      clone[idx] = nextPeer;
      return clone;
    });
  }, []);

  const removeRemotePeer = useCallback((userId) => {
    setRemotePeers((prev) => prev.filter((p) => p.userId !== userId));
  }, []);

  const stopStream = (stream) => {
    stream?.getTracks?.().forEach((track) => track.stop());
  };

  const endLocalCallState = useCallback(() => {
    clearTimeout(callTimeoutRef.current);
    clearAllPeerConnections();
    stopStream(localStreamRef.current);
    stopStream(remoteStreamRef.current);
    setLocalStream(null);
    setRemoteStream(null);
    setRemotePeers([]);
    setIncomingCall(null);
    setActivePeer(null);
    setIsMicMuted(false);
    setIsCamOff(false);
    setCallState("idle");
  }, [clearAllPeerConnections]);

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

  const createPeerConnection = useCallback((targetUserId, meta = {}) => {
    const socket = getSocket();
    const pc = new RTCPeerConnection(ICE_SERVERS);
    const conversationId = callMetaRef.current?.conversationId || activeConversation?._id;
    peerMetaRef.current.set(targetUserId, {
      conversationId,
      username: meta.username,
      avatar: meta.avatar,
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate || !socket) return;
      const pcMeta = peerMetaRef.current.get(targetUserId) || {};
      socket.emit("call:ice", {
        toUserId: targetUserId,
        payload: {
          candidate: event.candidate,
          conversationId: pcMeta.conversationId || conversationId,
        },
      });
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      if (!remoteStreamRef.current) setRemoteStream(stream);
      const pcMeta = peerMetaRef.current.get(targetUserId) || {};
      upsertRemotePeer(targetUserId, stream, pcMeta);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "failed" || state === "disconnected" || state === "closed") {
        clearPeerConnection(targetUserId);
        removeRemotePeer(targetUserId);
        if (!callMetaRef.current?.isGroup) {
          toast.error("Call connection lost");
          persistCallLog("cancelled");
          endLocalCallState();
        } else if (pcMapRef.current.size === 0 && callState === "in-call") {
          toast("Group call ended");
          persistCallLog("completed");
          endLocalCallState();
        }
      }
    };

    pcMapRef.current.set(targetUserId, pc);
    return pc;
  }, [activeConversation?._id, callState, clearPeerConnection, endLocalCallState, persistCallLog, removeRemotePeer, upsertRemotePeer]);

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
      await sendMessage(activeConversation._id, text.trim(), mediaFile, replyingTo?._id);
      setText("");
      setMediaFile(null);
      setMediaPreview(null);
      setShowEmoji(false);
      setReplyingTo(null);
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
    const isGroupCall = !!activeConversation?.isGroup;
    const targets = isGroupCall
      ? groupTargets
      : (otherParticipant ? [otherParticipant] : []);
    if (!targets.length) {
      toast.error(isGroupCall ? "No participants available for group call." : "No user available for call.");
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Calling is not supported in this browser/context.");
        return;
      }

      let stream = null;
      let fallbackNotice = "";
      if (type === "video") {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
            fallbackNotice = "Camera unavailable. Starting call with audio only.";
            setIsCamOff(true);
          } catch {
            fallbackNotice = "Mic/camera blocked. Starting receive-only call.";
          }
        }
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } catch {
          fallbackNotice = "Microphone blocked. Starting receive-only call.";
        }
      }

      setCallType(type);
      setLocalStream(stream);
      setRemoteStream(null);
      setRemotePeers([]);
      setActivePeer(isGroupCall
        ? {
            userId: activeConversation?._id,
            username: activeConversation?.groupName || "Group call",
            avatar: activeConversation?.groupAvatar || "",
          }
        : {
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
        direction: "outgoing",
        isGroup: isGroupCall,
        initiatorId: user?._id,
      };
      const socket = getSocket();
      const hasVideo = stream?.getVideoTracks?.().length > 0;
      const hasAudio = stream?.getAudioTracks?.().length > 0;
      for (const target of targets) {
        const pc = createPeerConnection(target._id, {
          username: target.username,
          avatar: target.avatar,
          conversationId: activeConversation?._id,
        });
        if (stream) {
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        }
        if (type === "video" && !hasVideo) {
          pc.addTransceiver("video", { direction: "recvonly" });
        }
        if (!hasAudio) {
          pc.addTransceiver("audio", { direction: "recvonly" });
        }
        // eslint-disable-next-line no-await-in-loop
        const offer = await pc.createOffer();
        // eslint-disable-next-line no-await-in-loop
        await pc.setLocalDescription(offer);
        socket?.emit("call:offer", {
          toUserId: target._id,
          payload: {
            sdp: offer,
            callType: type,
            conversationId: activeConversation?._id,
            fromName: user?.username,
            fromAvatar: user?.avatar,
            isGroup: isGroupCall,
          },
        });
      }
      if (isGroupCall) {
        socket?.emit("call:group:join", {
          conversationId: activeConversation?._id,
          callType: type,
        });
      }
      if (fallbackNotice) toast(fallbackNotice);

      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        toast.error("No answer");
        targets.forEach((target) => {
          socket?.emit("call:end", {
            toUserId: target._id,
            payload: { reason: "missed", conversationId: activeConversation?._id },
          });
        });
        persistCallLog("missed");
        endLocalCallState();
      }, CALL_RING_TIMEOUT_MS);
    } catch {
      toast.error("Could not start call.");
      endLocalCallState();
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall || isAnsweringRef.current) return;
    isAnsweringRef.current = true;
    const offerSnapshot = { ...incomingCall };

    try {
      const wantsVideo = offerSnapshot.callType === "video";
      const remoteOfferRaw = normalizeSdpPayload(offerSnapshot.sdp);
      const remoteOffer = remoteOfferRaw?.type
        ? remoteOfferRaw
        : remoteOfferRaw?.sdp
        ? { ...remoteOfferRaw, type: "offer" }
        : null;
      if (!remoteOffer || !remoteOffer?.sdp) {
        throw new Error("Invalid call offer");
      }

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: wantsVideo,
        });
      } catch (mediaError) {
        // If video capture fails, still allow receiver to join with audio.
        if (!wantsVideo) {
          toast("Microphone unavailable. Joining as receive-only.");
        } else {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
            setIsCamOff(true);
            toast("Camera unavailable. Joined with audio only.");
          } catch {
            toast("Mic/camera unavailable. Joining as receive-only.");
          }
        }
      }

      setCallType(incomingCall.callType);
      setLocalStream(stream);
      setRemoteStream(null);
      setActivePeer({
        userId: offerSnapshot.fromUserId,
        username: offerSnapshot.fromName,
        avatar: offerSnapshot.fromAvatar,
      });
      callMetaRef.current = {
        conversationId: offerSnapshot.conversationId,
        callType: offerSnapshot.callType || "audio",
        startedAt: Date.now(),
        logged: false,
        direction: "incoming",
        isGroup: !!offerSnapshot.isGroup,
        initiatorId: offerSnapshot.fromUserId,
      };

      clearPeerConnection(offerSnapshot.fromUserId);
      const pc = createPeerConnection(offerSnapshot.fromUserId, {
        username: offerSnapshot.fromName,
        avatar: offerSnapshot.fromAvatar,
        conversationId: offerSnapshot.conversationId,
      });
      await pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      } else {
        pc.addTransceiver("audio", { direction: "recvonly" });
      }
      if (wantsVideo && (!stream || stream.getVideoTracks().length === 0)) {
        pc.addTransceiver("video", { direction: "recvonly" });
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const socket = getSocket();
      socket?.emit("call:answer", {
        toUserId: offerSnapshot.fromUserId,
        payload: {
          sdp: { type: answer.type, sdp: answer.sdp },
          conversationId: offerSnapshot.conversationId,
        },
      });

      clearTimeout(callTimeoutRef.current);
      setIncomingCall(null);
      setCallState("in-call");
      if (offerSnapshot.isGroup) {
        socket?.emit("call:group:join", {
          conversationId: offerSnapshot.conversationId,
          callType: offerSnapshot.callType || "audio",
        });
      }
    } catch (err) {
      console.error("acceptIncomingCall failed", err);
      toast.error("Could not answer call.");
      endLocalCallState();
    } finally {
      isAnsweringRef.current = false;
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
    persistCallLog("declined");
  };

  const hangupCall = () => {
    const convId = callMetaRef.current?.conversationId || activeConversation?._id;
    const socket = getSocket();
    if (callMetaRef.current?.isGroup) {
      const targets = (activeConversation?.participants || [])
        .filter((p) => p._id !== user?._id)
        .map((p) => p._id);
      targets.forEach((uid) => {
        socket?.emit("call:end", {
          toUserId: uid,
          payload: { reason: "ended", conversationId: convId, isGroup: true },
        });
      });
    } else if (activePeer?.userId) {
      socket?.emit("call:end", {
        toUserId: activePeer.userId,
        payload: { reason: "ended", conversationId: convId },
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

    const onOffer = async (payload) => {
      const sameGroupCall =
        !!payload?.isGroup &&
        !!callMetaRef.current?.isGroup &&
        payload?.conversationId === callMetaRef.current?.conversationId &&
        callState !== "idle";
      if (sameGroupCall) {
        try {
          const remoteOffer = normalizeSdpPayload(payload.sdp);
          if (!remoteOffer?.type || !remoteOffer?.sdp) return;
          const pc = createPeerConnection(payload.fromUserId, {
            username: payload.fromName,
            avatar: payload.fromAvatar,
            conversationId: payload.conversationId,
          });
          await pc.setRemoteDescription(remoteOffer);
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
          } else {
            pc.addTransceiver("audio", { direction: "recvonly" });
            if ((payload.callType || "audio") === "video") {
              pc.addTransceiver("video", { direction: "recvonly" });
            }
          }
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("call:answer", {
            toUserId: payload.fromUserId,
            payload: {
              sdp: answer,
              conversationId: payload.conversationId,
              isGroup: true,
            },
          });
        } catch {
          // ignore individual peer setup errors in group call
        }
        return;
      }

      if (callState !== "idle") {
        socket.emit("call:end", {
          toUserId: payload.fromUserId,
          payload: { reason: "busy", conversationId: payload.conversationId },
        });
        return;
      }

      if (payload?.conversationId && payload.conversationId !== activeConversation?._id) {
        const targetConv = useChatStore.getState().conversations.find((c) => c._id === payload.conversationId);
        if (targetConv) setActiveConversation(targetConv);
      }

      setIncomingCall({
        fromUserId: payload.fromUserId,
        fromName: payload.fromName || "Unknown",
        fromAvatar: payload.fromAvatar || "",
        sdp: payload.sdp,
        callType: payload.callType || "audio",
        conversationId: payload.conversationId,
        isGroup: !!payload.isGroup,
      });
      setCallType(payload.callType || "audio");
      setCallState("ringing");
      callMetaRef.current = {
        conversationId: payload.conversationId,
        callType: payload.callType || "audio",
        startedAt: Date.now(),
        logged: false,
        direction: "incoming",
        isGroup: !!payload.isGroup,
        initiatorId: payload.fromUserId,
      };
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        socket.emit("call:end", {
          toUserId: payload.fromUserId,
          payload: { reason: "missed", conversationId: payload.conversationId },
        });
        setIncomingCall(null);
        setCallState("idle");
      }, CALL_RING_TIMEOUT_MS);
    };

    const onAnswer = async (payload) => {
      const pc = pcMapRef.current.get(payload.fromUserId) || [...pcMapRef.current.values()][0];
      if (!pc) return;
      try {
        const remoteAnswer = normalizeSdpPayload(payload.sdp);
        if (!remoteAnswer?.type || !remoteAnswer?.sdp) return;
        await pc.setRemoteDescription(remoteAnswer);
        clearTimeout(callTimeoutRef.current);
        if (payload?.fromUserId) {
          const p =
            (activeConversation?.participants || []).find((u) => u._id === payload.fromUserId) || null;
          if (p) {
            peerMetaRef.current.set(payload.fromUserId, {
              ...(peerMetaRef.current.get(payload.fromUserId) || {}),
              username: p.username,
              avatar: p.avatar,
              conversationId: payload.conversationId || activeConversation?._id,
            });
          }
        }
        setCallState("in-call");
      } catch {
        toast.error("Call connection failed");
        endLocalCallState();
      }
    };

    const onIce = async (payload) => {
      const pc = pcMapRef.current.get(payload.fromUserId) || [...pcMapRef.current.values()][0];
      if (!pc || !payload?.candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // Ignore invalid ICE candidates
      }
    };

    const onGroupParticipantJoined = async (payload) => {
      const meta = callMetaRef.current;
      if (!meta?.isGroup) return;
      if (meta.conversationId !== payload?.conversationId) return;
      if (callState !== "in-call" && callState !== "calling") return;
      if (!payload?.participantId || payload.participantId === user?._id) return;
      if (pcMapRef.current.has(payload.participantId)) return;

      try {
        const pc = createPeerConnection(payload.participantId, {
          username: payload.participantName,
          avatar: payload.participantAvatar,
          conversationId: payload.conversationId,
        });
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
        } else {
          pc.addTransceiver("audio", { direction: "recvonly" });
          if ((meta.callType || "audio") === "video") pc.addTransceiver("video", { direction: "recvonly" });
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:offer", {
          toUserId: payload.participantId,
          payload: {
            sdp: offer,
            callType: meta.callType || "audio",
            conversationId: payload.conversationId,
            fromName: user?.username,
            fromAvatar: user?.avatar,
            isGroup: true,
          },
        });
      } catch {
        // ignore peer creation failure to keep existing call alive
      }
    };

    const onEnd = (payload) => {
      if (callMetaRef.current?.isGroup && payload?.fromUserId) {
        clearPeerConnection(payload.fromUserId);
        removeRemotePeer(payload.fromUserId);
        if (pcMapRef.current.size === 0 && callState === "in-call") {
          toast("Group call ended");
          persistCallLog("completed");
          endLocalCallState();
        }
        return;
      }
      if (payload?.reason === "busy") toast.error("User is busy on another call");
      if (payload?.reason === "declined") toast.error("Call was declined");
      if (payload?.reason === "unavailable") toast.error("User is offline or unavailable");
      if (payload?.reason === "missed") toast.error("Call missed");
      if (payload?.reason !== "busy" && payload?.reason !== "declined") {
        toast("Call ended");
      }
      if (payload?.reason === "busy" || payload?.reason === "missed" || payload?.reason === "unavailable") {
        persistCallLog("missed");
      } else if (payload?.reason === "declined") persistCallLog("declined");
      else persistCallLog(callState === "in-call" ? "completed" : "cancelled");
      endLocalCallState();
    };

    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice", onIce);
    socket.on("call:end", onEnd);
    socket.on("call:group:participant-joined", onGroupParticipantJoined);

    return () => {
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice", onIce);
      socket.off("call:end", onEnd);
      socket.off("call:group:participant-joined", onGroupParticipantJoined);
    };
  }, [activeConversation?._id, activeConversation?.participants, callState, conversations, createPeerConnection, endLocalCallState, persistCallLog, removeRemotePeer, setActiveConversation, user?._id, user?.avatar, user?.username, clearPeerConnection]);

  useEffect(() => {
    return () => {
      endLocalCallState();
    };
  }, []);

  if (listenerOnly) {
    return (callState !== "idle" || incomingCall) ? (
      <CallOverlay
        callState={callState}
        callType={callType}
        incomingCall={incomingCall}
        peer={activePeer}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        localStream={localStream}
        remoteStream={remoteStream}
        remotePeers={remotePeers}
        onAccept={acceptIncomingCall}
        onDecline={declineIncomingCall}
        onHangup={hangupCall}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        isMicMuted={isMicMuted}
        isCamOff={isCamOff}
      />
    ) : null;
  }

  return (
    <div className="flex h-full min-w-0 relative">
      <div className="flex flex-col flex-1 min-w-0 bg-[#efeae2] dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f0f2f5] dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 relative">
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
              disabled={(!otherParticipant && !activeConversation?.isGroup) || callState !== "idle"}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-50"
              title="Voice call"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </button>
            <button
              onClick={() => startCall("video")}
              disabled={(!otherParticipant && !activeConversation?.isGroup) || callState !== "idle"}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-50"
              title="Video call"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            </button>
            <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              onClick={() => setShowChatMenu((v) => !v)}
              title="More options"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showChatMenu && (
              <div ref={menuRef}
                className="absolute top-12 right-2 z-50 w-52 bg-white dark:bg-[#233138] rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 py-1 overflow-hidden"
              >
                {[
                  {
                    label: activeConversation?.isGroup ? "Group info" : "Contact info",
                    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
                    action: () => { setShowInfo(true); setShowChatMenu(false); },
                  },
                  {
                    label: "Search",
                    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>,
                    action: () => { setSearchOpen((v) => !v); setShowChatMenu(false); },
                  },
                  {
                    label: "Mute notifications",
                    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>,
                    action: () => { toast("Mute notifications — coming soon"); setShowChatMenu(false); },
                  },
                  {
                    label: "Close chat",
                    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>,
                    action: () => { useChatStore.setState({ activeConversation: null }); setShowChatMenu(false); },
                  },
                  {
                    label: "Clear chat",
                    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
                    action: async () => {
                      if (!window.confirm("Clear all messages in this chat?")) return;
                      setShowChatMenu(false);
                      try {
                        await useChatStore.getState().deleteConversation(activeConversation._id);
                        toast.success("Chat cleared");
                      } catch { toast.error("Failed to clear chat"); }
                    },
                    danger: true,
                  },
                  ...(activeConversation?.isGroup ? [{
                    label: "Exit group",
                    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>,
                    action: async () => {
                      if (!window.confirm("Exit this group?")) return;
                      setShowChatMenu(false);
                      try {
                        await useChatStore.getState().deleteConversation(activeConversation._id);
                        toast.success("Left group");
                      } catch { toast.error("Failed to exit group"); }
                    },
                    danger: true,
                  }] : []),
                ].map((item) => (
                  <button key={item.label} onClick={item.action}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition hover:bg-gray-50 dark:hover:bg-[#182229] ${item.danger ? "text-red-500" : "text-gray-700 dark:text-[#e9edef]"}`}>
                    <span className={item.danger ? "text-red-400" : "text-gray-400 dark:text-[#8696a0]"}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* In-chat search bar */}
        {searchOpen && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#f0f2f5] dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input autoFocus type="text" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in conversation…"
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              </button>
            )}
            <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-gray-400 hover:text-gray-600 ml-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        )}

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

          {messages
            .filter((msg) => !searchQuery || msg.text?.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((msg, idx, arr) => {
            const currentKey = toDayKey(msg.createdAt);
            const prevKey = idx > 0 ? toDayKey(arr[idx - 1].createdAt) : null;
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
                <MessageBubble message={msg} isOwn={msg.sender._id === user._id || msg.sender === user._id}
                  onReply={(m) => setReplyingTo(m)}
                  onForward={(m) => setForwardMsg(m)}
                />
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

        {/* Reply preview bar */}
        {replyingTo && (
          <div className="flex items-center gap-3 px-4 py-2 bg-[#f0f2f5] dark:bg-[#1f2c33] border-t border-gray-200 dark:border-gray-700">
            <div className="flex-1 min-w-0 border-l-4 border-[#00a884] pl-3 py-1 bg-white/50 dark:bg-white/5 rounded-r-lg">
              <p className="text-xs font-semibold text-[#00a884] truncate">{replyingTo.sender?.username || "You"}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {replyingTo.text || (replyingTo.media?.url ? "📎 Media" : "")}
              </p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            </button>
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

          {/* Attach menu */}
          <div className="relative" ref={attachMenuRef}>
            <button type="button" onClick={() => setShowAttachMenu((v) => !v)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition" title="Attach">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            {showAttachMenu && (
              <div className="absolute bottom-12 left-0 z-50 bg-white dark:bg-[#233138] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 py-2 w-52 overflow-hidden">
                {[
                  { label: "Document", color: "bg-[#5157ae]", action: () => { documentRef.current?.click(); setShowAttachMenu(false); },
                    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> },
                  { label: "Photos & videos", color: "bg-[#bf59cf]", action: () => { photoVideoRef.current?.click(); setShowAttachMenu(false); },
                    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> },
                  { label: "Camera", color: "bg-[#e06c4a]", action: () => { const i=document.createElement("input"); i.type="file"; i.accept="image/*"; i.capture="environment"; i.onchange=(e)=>handleFileChange({target:e.target}); i.click(); setShowAttachMenu(false); },
                    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
                  { label: "Audio", color: "bg-[#e05c7a]", action: () => { audioRef.current?.click(); setShowAttachMenu(false); },
                    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg> },
                  { label: "Contact", color: "bg-[#009de2]", action: () => { toast("Contact sharing coming soon"); setShowAttachMenu(false); },
                    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg> },
                  { label: "Poll", color: "bg-[#1fa855]", action: () => { toast("Poll feature coming soon"); setShowAttachMenu(false); },
                    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
                ].map((item) => (
                  <button key={item.label} type="button" onClick={item.action}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#182229] transition text-left">
                    <div className={`w-9 h-9 rounded-full ${item.color} flex items-center justify-center flex-shrink-0`}>{item.icon}</div>
                    <span className="text-sm text-gray-700 dark:text-[#e9edef] font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            )}

            <input ref={photoVideoRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
            <input ref={documentRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" className="hidden" onChange={handleFileChange} />
            <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
            <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />
          </div>
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

      {/* Forward message modal */}
      {forwardMsg && (
        <ForwardModal
          message={forwardMsg}
          conversations={useChatStore.getState().conversations}
          onClose={() => setForwardMsg(null)}
        />
      )}

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
          remotePeers={remotePeers}
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

function ForwardModal({ message, conversations, onClose }) {
  const { sendMessage } = useChatStore();
  const [selected, setSelected] = useState([]);
  const [sending, setSending] = useState(false);
  const { user } = useAuthStore();

  const getOther = (conv) => conv.participants?.find((p) => p._id !== user?._id);
  const convName = (conv) => conv.isGroup ? conv.groupName : getOther(conv)?.username || "Unknown";

  const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const handleForward = async () => {
    if (!selected.length) return;
    setSending(true);
    try {
      await Promise.all(selected.map((convId) =>
        sendMessage(convId, message.text || "", null, null)
      ));
      toast.success(`Forwarded to ${selected.length} chat${selected.length > 1 ? "s" : ""}`);
      onClose();
    } catch {
      toast.error("Forward failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1f2c33] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Forward message</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-[#111b21]">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate px-2">
            "{message.text || "📎 Media"}"
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {conversations.map((conv) => (
            <button key={conv._id} onClick={() => toggle(conv._id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#182229] transition text-left">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected.includes(conv._id) ? "bg-[#00a884] border-[#00a884]" : "border-gray-300 dark:border-gray-600"}`}>
                {selected.includes(conv._id) && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
              </div>
              <span className="text-sm text-gray-800 dark:text-[#e9edef] truncate">{convName(conv)}</span>
            </button>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <button onClick={handleForward} disabled={!selected.length || sending}
            className="w-full py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold rounded-xl transition disabled:opacity-50 text-sm">
            {sending ? "Forwarding…" : `Forward${selected.length ? ` (${selected.length})` : ""}`}
          </button>
        </div>
      </div>
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
  remotePeers = [],
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
  const joinedCount = Math.max(1, remotePeers.length + 1);

  return (
    <div className="fixed inset-0 z-[250] bg-[#040712]">
      <div className="relative w-full h-full overflow-hidden bg-[#050817]">
        {showRemoteVideo && (
          <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
        )}

        {!showRemoteVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-[#b8bfd1] mb-4 flex items-center justify-center">
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl text-white font-semibold">{name?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <p className="text-[#d9dbe3] text-[30px] sm:text-[44px] font-medium leading-none px-4 text-center break-words">{name}</p>
            <p className="text-[#8f95a6] mt-2 text-base">
              {showIncoming
                ? `Incoming ${isVideo ? "video" : "voice"} call`
                : callState === "calling"
                ? "calling..."
                : `${joinedCount} participant${joinedCount > 1 ? "s" : ""} in call`}
            </p>
          </div>
        )}

        {showLocalVideo && (
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 w-32 h-24 sm:w-56 sm:h-36 rounded-xl sm:rounded-2xl overflow-hidden border border-white/20 bg-black/30">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          </div>
        )}

        {!showIncoming && (
          <button
            onClick={onHangup}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#e3e8f3] text-[#61697f] flex items-center justify-center hover:bg-white"
            title="Close call"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>
        )}

        {!showIncoming && (
          <>
            <button className="absolute left-4 bottom-6 sm:left-8 sm:bottom-8 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#e3e8f3] text-[#61697f] flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z" />
              </svg>
            </button>
            <button className="absolute right-4 bottom-6 sm:right-8 sm:bottom-8 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#e3e8f3] text-[#61697f] flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </>
        )}

        {showIncoming ? (
          <div className="absolute bottom-8 sm:bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 sm:gap-4 px-4 w-full max-w-md justify-center">
            <button onClick={onDecline} className="px-5 sm:px-7 py-2.5 sm:py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium">
              Decline
            </button>
            <button onClick={onAccept} className="px-5 sm:px-7 py-2.5 sm:py-3 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white font-medium">
              Accept
            </button>
          </div>
        ) : (
          <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 sm:gap-4 px-4">
            {isVideo && (
              <button
                onClick={onToggleCamera}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center ${isCamOff ? "bg-[#2b3142] text-white" : "bg-[#f3f5fa] text-[#61697f]"}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m-9 5h8a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            <button
              onClick={onToggleMute}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center ${isMicMuted ? "bg-[#2b3142] text-white" : "bg-[#f3f5fa] text-[#61697f]"}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v11m0 0a3 3 0 003-3V6a3 3 0 10-6 0v3a3 3 0 003 3zm0 0v4m-4 0h8M5 10v1a7 7 0 0014 0v-1" />
              </svg>
            </button>
            <button onClick={onHangup} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#e53935] hover:bg-[#d32f2f] text-white flex items-center justify-center">
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
