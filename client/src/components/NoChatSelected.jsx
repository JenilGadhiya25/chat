import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function NoChatSelected({ onOpenAi = () => {} }) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const platform = useMemo(() => {
    const ua = (navigator.userAgent || "").toLowerCase();
    const isWindows = ua.includes("windows");
    const isMac = ua.includes("mac os") || ua.includes("macintosh");
    if (isWindows) {
      return {
        title: "Download WhatsApp for Windows",
        subtitle: "Make calls and get a faster experience when you download the Windows app.",
        cta: "Get from Microsoft Store",
        url: "https://www.microsoft.com/store/apps/9NKSQGP7F2NH",
      };
    }
    if (isMac) {
      return {
        title: "Download WhatsApp for Mac",
        subtitle: "Make calls and get a faster experience when you download the Mac app.",
        cta: "Get from App Store",
        url: "https://apps.apple.com/app/whatsapp-messenger/id310633997",
      };
    }
    return {
      title: "Download WhatsApp Desktop",
      subtitle: "Make calls and get a faster experience when you download the desktop app.",
      cta: "Go to Download Page",
      url: "https://www.whatsapp.com/download",
    };
  }, []);

  const handleStoreClick = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex-1 bg-[#0b0f13] flex items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-[470px]">
        <div className="mx-auto max-w-[390px] rounded-[24px] bg-[#181d22] px-6 py-7 text-center border border-white/5 shadow-[0_16px_36px_rgba(0,0,0,0.4)]">
          <div className="w-[122px] h-[86px] mx-auto mb-6 rounded-xl bg-[#1f252b] flex items-center justify-center">
            <svg className="w-[102px] h-[72px]" viewBox="0 0 170 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="26" y="24" width="112" height="68" rx="8" fill="#DCD7CC" />
              <rect x="26" y="24" width="56" height="68" rx="8" fill="#2ED66B" />
              <path d="M57 38h16M45 24h80" stroke="#0E161D" strokeWidth="4" strokeLinecap="round" />
              <path d="M54 50h20M54 62h20M54 74h20" stroke="#0E161D" strokeWidth="4" strokeLinecap="round" />
              <path d="M108 51c8 8 12 16 7 21-5 5-13 1-21-7-4-4-7-8-8-12-1-2 0-4 2-5l7-4c2-1 3 0 4 1l2 3c1 1 2 2 3 3l4-2c1-1 3-1 4 0z" fill="#2ED66B" stroke="#0E161D" strokeWidth="3" strokeLinejoin="round" />
              <path d="M10 104h150" stroke="#CFEECF" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </div>

          <h2 className="text-[41px] leading-[1.06] font-semibold text-white mb-3">{platform.title}</h2>
          <p className="text-[23px] leading-[1.3] text-[#9ea4ab] max-w-[320px] mx-auto mb-6">
            {platform.subtitle}
          </p>

          <button
            onClick={handleStoreClick}
            className="h-[50px] px-8 rounded-full bg-[#0e6a46] hover:bg-[#0f7b52] text-[#d4f5dc] text-[25px] font-semibold transition"
          >
            {platform.cta}
          </button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { label: "Send document", icon: "doc" },
            { label: "Add contact", icon: "user" },
            { label: "Ask Meta AI", icon: "ring" },
          ].map((item) => (
            <button
              key={item.label}
              className="group text-center"
              onClick={item.label === "Ask Meta AI" ? onOpenAi : undefined}
            >
              <div className="h-[108px] rounded-[18px] bg-[#2b2f34] border border-white/5 flex items-center justify-center group-hover:bg-[#333940] transition">
                {item.icon === "doc" && (
                  <svg className="w-8 h-8 text-[#c2c6cc]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M8 13h8M8 17h5" />
                  </svg>
                )}
                {item.icon === "user" && (
                  <svg className="w-8 h-8 text-[#c2c6cc]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="9" cy="8" r="3.5" />
                    <path d="M3 19c0-3.2 2.6-5.5 6-5.5S15 15.8 15 19" />
                    <path d="M19 8v6M16 11h6" />
                  </svg>
                )}
                {item.icon === "ring" && (
                  <div className="w-9 h-9 rounded-full border-[5px] border-[#2775ff] border-t-[#8a4bff] border-r-[#32d1ff]" />
                )}
              </div>
              <p className="mt-3 text-[20px] text-[#aeb3b9]">{item.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
