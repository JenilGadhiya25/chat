import toast from "react-hot-toast";

// Request browser notification permission once
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
};

// Play a soft notification beep (generated via Web Audio API — no file needed)
const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // AudioContext blocked — silently ignore
  }
};

/**
 * Show a notification for an incoming message.
 * @param {object} message  - the message object from socket
 * @param {boolean} isActive - true if the conversation is currently open
 */
export const showMessageNotification = (message, isActive) => {
  const senderName = message.sender?.username || "Someone";
  const body = message.text
    ? message.text.length > 60 ? message.text.slice(0, 60) + "…" : message.text
    : "📎 Sent a file";

  // Always play sound
  playBeep();

  // In-app toast (always shown for incoming messages)
  toast.custom(
    (t) => (
      <div
        onClick={() => toast.dismiss(t.id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#1f2c33",
          color: "#e9edef",
          borderRadius: 12,
          padding: "10px 14px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
          cursor: "pointer",
          maxWidth: 320,
          opacity: t.visible ? 1 : 0,
          transition: "opacity 0.2s",
          border: isActive ? "1px solid rgba(0,168,132,0.25)" : "1px solid transparent",
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: "#00a884", display: "flex", alignItems: "center",
          justifyContent: "center", fontWeight: 700, fontSize: 15,
          color: "#fff", flexShrink: 0,
        }}>
          {senderName[0].toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#00a884" }}>
            {senderName}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#8696a0", marginTop: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 230 }}>
            {body}
          </p>
        </div>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00a884", flexShrink: 0 }}/>
      </div>
    ),
    { duration: isActive ? 2500 : 4000, position: "top-right" }
  );

  // Browser / OS notification (only when tab is not focused)
  if (document.hidden && Notification.permission === "granted") {
    const n = new Notification(`💬 ${senderName}`, {
      body,
      icon: "/chat-icon.svg",
      badge: "/chat-icon.svg",
      tag: message.conversationId, // group by conversation
      renotify: true,
    });
    n.onclick = () => { window.focus(); n.close(); };
  }
};
