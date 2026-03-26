import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore";
import { connectSocket } from "../lib/socket";
import { useNavigate } from "react-router-dom";

// Desktop socket connects to the configured server
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:8000";
const LAN_IP = import.meta.env.VITE_LAN_IP;

// In production (no LAN_IP set), phone uses the same Render server URL
// In local dev, phone uses LAN IP so it can reach the laptop's server
const PHONE_SERVER_URL = LAN_IP
  ? `http://${LAN_IP}:8000`
  : SERVER_URL; // e.g. https://chat-995k.onrender.com

// Confirm page base: in production use current origin (Netlify URL)
// In local dev use LAN IP so phone can open the Vite dev server
const CONFIRM_BASE = LAN_IP
  ? `http://${LAN_IP}:5173`
  : window.location.origin; // e.g. https://chatify-superapp.netlify.app

function Ghost({ size = 100 }) {
  const s = size;
  return (
    <svg width={s} height={s * 1.15} viewBox={`0 0 ${s} ${s * 1.15}`} className="ghost-svg">
      <path d={`M${s*.1},${s*.45} Q${s*.1},${s*.05} ${s*.5},${s*.05} Q${s*.9},${s*.05} ${s*.9},${s*.45} L${s*.9},${s*1.05} Q${s*.8},${s*.88} ${s*.7},${s*1.05} Q${s*.6},${s*.88} ${s*.5},${s*1.05} Q${s*.4},${s*.88} ${s*.3},${s*1.05} Q${s*.2},${s*.88} ${s*.1},${s*1.05} Z`}
        fill="#00a884" opacity="0.93"/>
      <circle cx={s*.32} cy={s*.38} r={s*.1} fill="white"/>
      <circle cx={s*.68} cy={s*.38} r={s*.1} fill="white"/>
      <circle cx={s*.35} cy={s*.41} r={s*.055} fill="#004d3d"/>
      <circle cx={s*.71} cy={s*.41} r={s*.055} fill="#004d3d"/>
      <path d={`M${s*.35},${s*.58} Q${s*.5},${s*.7} ${s*.65},${s*.58}`}
        stroke="white" strokeWidth={s*.04} strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function Sparkles() {
  const items = [
    {x:"12%",y:"18%",d:"0s",f:18},{x:"82%",y:"12%",d:"0.4s",f:14},
    {x:"72%",y:"72%",d:"0.8s",f:20},{x:"18%",y:"78%",d:"0.2s",f:12},
    {x:"50%",y:"8%",d:"1.1s",f:16},{x:"90%",y:"48%",d:"0.6s",f:10},
    {x:"8%",y:"52%",d:"1.4s",f:14},{x:"55%",y:"88%",d:"0.9s",f:18},
  ];
  return (
    <>
      {items.map((it, i) => (
        <span key={i} className="sparkle-star"
          style={{position:"absolute",left:it.x,top:it.y,fontSize:it.f,animationDelay:it.d,zIndex:2}}>
          ✦
        </span>
      ))}
    </>
  );
}

function ScannedOverlay({ status }) {
  const isAuth = status === "authenticated";
  return (
    <div style={{
      position:"fixed",inset:0,zIndex:200,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      background: isAuth
        ? "linear-gradient(135deg,#004d3d 0%,#00a884 55%,#00d4a8 100%)"
        : "linear-gradient(135deg,#1a1a2e 0%,#16213e 55%,#0f3460 100%)",
      overflow:"hidden",
    }}>
      <Sparkles/>
      {[1,2,3].map(i => (
        <span key={i} className="qr-ripple" style={{animationDelay:`${(i-1)*0.5}s`}}/>
      ))}
      <div className="qr-ghost-float" style={{zIndex:3}}>
        <Ghost size={120}/>
      </div>
      <div style={{textAlign:"center",marginTop:28,zIndex:3,padding:"0 24px"}}>
        {isAuth ? (
          <>
            <p style={{fontSize:30,fontWeight:800,color:"#fff",margin:0}}>You're in!</p>
            <p style={{fontSize:14,color:"rgba(255,255,255,0.75)",marginTop:10}}>Opening your chats…</p>
          </>
        ) : (
          <>
            <p style={{fontSize:26,fontWeight:700,color:"#fff",margin:0}}>QR Scanned!</p>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginTop:8}}>Confirm on your phone to finish…</p>
            <div style={{display:"flex",gap:7,justifyContent:"center",marginTop:16}}>
              {[0,1,2].map(i => (
                <span key={i} className="qr-dot" style={{animationDelay:`${i*0.18}s`}}/>
              ))}
            </div>
          </>
        )}
      </div>
      <style>{`
        .qr-ghost-float{animation:qrGhostFloat 1.6s ease-in-out infinite;}
        @keyframes qrGhostFloat{0%,100%{transform:translateY(0) rotate(-3deg);}50%{transform:translateY(-20px) rotate(3deg);}}
        .ghost-svg{filter:drop-shadow(0 10px 28px rgba(0,0,0,0.4));}
        .sparkle-star{color:rgba(255,255,255,0.85);animation:qrSparkle 1.8s ease-in-out infinite;}
        @keyframes qrSparkle{0%,100%{opacity:.2;transform:scale(.7) rotate(0deg);}50%{opacity:1;transform:scale(1.4) rotate(180deg);}}
        .qr-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.85);animation:qrDotBounce .7s ease-in-out infinite alternate;}
        @keyframes qrDotBounce{from{transform:translateY(0);opacity:.5;}to{transform:translateY(-12px);opacity:1;}}
        .qr-ripple{position:absolute;width:220px;height:220px;border-radius:50%;border:2px solid rgba(255,255,255,.15);animation:qrRipple 2.4s ease-out infinite;}
        @keyframes qrRipple{0%{transform:scale(.5);opacity:.6;}100%{transform:scale(4.5);opacity:0;}}
      `}</style>
    </div>
  );
}

export default function QRLogin({ onClose }) {
  const [qrToken, setQrToken] = useState(null);
  const [status, setStatus] = useState("loading");
  const [countdown, setCountdown] = useState(60);
  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const countRef = useRef(null);
  const navigate = useNavigate();

  const startCountdown = () => {
    setCountdown(60);
    clearInterval(countRef.current);
    countRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(countRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("qr:request");
    });

    socket.on("connect_error", () => {
      setStatus("expired");
    });

    socket.on("qr:token", token => {
      setQrToken(token);
      setStatus("waiting");
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setStatus("expired");
        clearInterval(countRef.current);
      }, 60000);
      startCountdown();
    });

    socket.on("qr:scanned", () => setStatus("scanned"));

    socket.on("qr:authenticated", ({ token, user }) => {
      clearTimeout(timerRef.current);
      clearInterval(countRef.current);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      useAuthStore.setState({ user, token });
      connectSocket(user._id);
      setStatus("authenticated");
      // Show animation briefly then open chat — like real WhatsApp
      setTimeout(() => {
        socket.disconnect();
        navigate("/", { replace: true });
      }, 1500);
    });

    socket.on("qr:error", () => {
      setStatus("expired");
      clearInterval(countRef.current);
    });

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(countRef.current);
      socket.disconnect();
    };
  }, []);

  const refresh = () => {
    setQrToken(null);
    setStatus("loading");
    clearTimeout(timerRef.current);
    clearInterval(countRef.current);
    socketRef.current?.emit("qr:request");
  };

  const confirmUrl = qrToken
    ? `${CONFIRM_BASE}/qr-confirm?token=${encodeURIComponent(qrToken)}&server=${encodeURIComponent(PHONE_SERVER_URL)}`
    : "";

  if (status === "scanned" || status === "authenticated") {
    return <ScannedOverlay status={status}/>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1f2c33] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#00a884] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3v3m-3-6v.01M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4z"/>
            </svg>
            <h2 className="text-white font-semibold text-lg">Scan to Log In</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>

        <div className="p-6 flex gap-6">
          {/* QR box */}
          <div className="flex-shrink-0">
            <div className="relative w-48 h-48 bg-white rounded-xl border-2 border-gray-200 flex items-center justify-center p-2 shadow-inner">
              {status === "loading" && (
                <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin"/>
              )}
              {status === "waiting" && qrToken && (
                <>
                  <QRCodeSVG value={confirmUrl} size={172} level="M" includeMargin={false}/>
                  {["top-1 left-1 border-t-2 border-l-2 rounded-tl","top-1 right-1 border-t-2 border-r-2 rounded-tr",
                    "bottom-1 left-1 border-b-2 border-l-2 rounded-bl","bottom-1 right-1 border-b-2 border-r-2 rounded-br"
                  ].map((cls, i) => <div key={i} className={"absolute w-5 h-5 border-[#00a884] " + cls}/>)}
                </>
              )}
              {status === "expired" && (
                <div className="flex flex-col items-center gap-2 text-center">
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  <p className="text-xs text-gray-400">Expired</p>
                  <button onClick={refresh} className="text-xs text-[#00a884] font-semibold hover:underline">Refresh</button>
                </div>
              )}
            </div>
            {status === "waiting" && (
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse"/>
                <span className="text-xs text-gray-400">Expires in {countdown}s</span>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="flex-1 flex flex-col justify-center gap-4">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white text-sm mb-3">How to scan:</h3>
              <ol className="space-y-3">
                {[
                  "Open this app on your phone browser",
                  "Log in with your account on the phone",
                  "Scan this QR code with your phone camera",
                  "Tap the link — you'll be logged in instantly",
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#00a884] text-white text-xs flex items-center justify-center font-bold mt-0.5">{i+1}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{text}</span>
                  </li>
                ))}
              </ol>
            </div>
            {confirmUrl && status === "waiting" && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                <p className="text-xs text-gray-400 mb-1.5">Testing on same device?</p>
                <a href={confirmUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[#00a884] hover:underline font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                  </svg>
                  Open confirm page
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
