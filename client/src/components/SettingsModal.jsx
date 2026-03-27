import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import { applyTheme, isDarkModeEnabled } from "../lib/theme";
import { resolveMediaUrl } from "../lib/mediaUrl";
import api from "../lib/axios";
import Avatar from "./Avatar";

const AVATAR_PRESETS = [
  "/presets/avatars/avatar-1.svg",
  "/presets/avatars/avatar-2.svg",
  "/presets/avatars/avatar-3.svg",
];

const BG_PRESETS = [
  "/presets/backgrounds/bg-1.svg",
  "/presets/backgrounds/bg-2.svg",
  "/presets/backgrounds/bg-3.svg",
];

const SETTINGS_KEYS = {
  enterSend: "settings_enter_send",
  fontSize: "settings_font_size",
  language: "settings_language",
  notifMsg: "settings_notif_msg",
  notifGroup: "settings_notif_group",
  notifSound: "settings_notif_sound",
};

const resolveUrl = (url) => {
  if (!url) return "";
  return resolveMediaUrl(url);
};

const readBool = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === "true";
  } catch {
    return fallback;
  }
};

const writeBool = (key, value) => {
  try {
    localStorage.setItem(key, value ? "true" : "false");
  } catch {}
};

const applyFontSize = (size) => {
  const map = { small: "14px", medium: "16px", large: "18px" };
  document.documentElement.style.fontSize = map[size] || "16px";
};

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full relative transition ${value ? "bg-[#25d366]" : "bg-gray-300"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${value ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function SettingRow({ title, desc, right }) {
  return (
    <div className="flex items-center justify-between py-3 gap-4 border-b border-gray-100 dark:border-[#2a3942] last:border-b-0">
      <div>
        <p className="text-[15px] font-medium text-[#111b21] dark:text-[#e9edef]">{title}</p>
        {desc ? <p className="text-sm text-gray-500">{desc}</p> : null}
      </div>
      <div>{right}</div>
    </div>
  );
}

export default function SettingsModal({ open, onClose }) {
  const { user, updateProfile } = useAuthStore();
  const { conversations, deleteConversation, fetchConversations } = useChatStore();

  const avatarInputRef = useRef(null);
  const bgInputRef = useRef(null);

  const [section, setSection] = useState("chats");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreset, setAvatarPreset] = useState("");

  const [bgPreview, setBgPreview] = useState("");
  const [bgFile, setBgFile] = useState(null);
  const [bgPreset, setBgPreset] = useState("");
  const [clearBg, setClearBg] = useState(false);

  const [darkMode, setDarkMode] = useState(false);
  const [enterSend, setEnterSend] = useState(true);
  const [fontSize, setFontSize] = useState("medium");
  const [language, setLanguage] = useState("English (US)");
  const [notifMsg, setNotifMsg] = useState(true);
  const [notifGroup, setNotifGroup] = useState(true);
  const [notifSound, setNotifSound] = useState(true);

  const [storageKb, setStorageKb] = useState(0);

  useEffect(() => {
    if (!open) return;
    setSection("chats");
    setUsername(user?.username || "");
    setEmail(user?.email || "");
    setAvatarPreview(resolveUrl(user?.avatar) || "");
    setAvatarFile(null);
    setAvatarPreset(AVATAR_PRESETS.includes(user?.avatar) ? user.avatar : "");

    setBgPreview(resolveUrl(user?.chatBackground) || "");
    setBgFile(null);
    setBgPreset(BG_PRESETS.includes(user?.chatBackground) ? user.chatBackground : "");
    setClearBg(false);

    setDarkMode(isDarkModeEnabled());
    setEnterSend(readBool(SETTINGS_KEYS.enterSend, true));
    setFontSize(localStorage.getItem(SETTINGS_KEYS.fontSize) || "medium");
    setLanguage(localStorage.getItem(SETTINGS_KEYS.language) || "English (US)");
    setNotifMsg(readBool(SETTINGS_KEYS.notifMsg, true));
    setNotifGroup(readBool(SETTINGS_KEYS.notifGroup, true));
    setNotifSound(readBool(SETTINGS_KEYS.notifSound, true));

    try {
      const size = new Blob(Object.keys(localStorage).map((k) => localStorage.getItem(k) || "")).size;
      setStorageKb(Math.round(size / 1024));
    } catch {
      setStorageKb(0);
    }
  }, [open, user]);

  const bgDisplay = useMemo(() => {
    if (clearBg) return "";
    if (bgPreview) return bgPreview;
    return resolveUrl(user?.chatBackground);
  }, [clearBg, bgPreview, user?.chatBackground]);

  if (!open) return null;

  const nav = [
    { key: "account", title: "Account", sub: "Privacy, Security, Change Number" },
    { key: "chats", title: "Chats", sub: "Theme, Wallpaper, Chat History" },
    { key: "notifications", title: "Notifications", sub: "Message, Group & Call tone" },
    { key: "storage", title: "Storage & Data", sub: "Network Usage, Auto-download" },
    { key: "help", title: "Help", sub: "Help centre, Contact us, Policy" },
  ];

  const saveSettings = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("username", username.trim());
      fd.append("email", email.trim());
      if (avatarFile) fd.append("avatar", avatarFile);
      else if (avatarPreset) fd.append("avatarPreset", avatarPreset);

      if (bgFile) fd.append("background", bgFile);
      else if (bgPreset) fd.append("backgroundPreset", bgPreset);
      if (clearBg) fd.append("clearBackground", "true");

      await updateProfile(fd);

      writeBool(SETTINGS_KEYS.enterSend, enterSend);
      localStorage.setItem(SETTINGS_KEYS.fontSize, fontSize);
      localStorage.setItem(SETTINGS_KEYS.language, language);
      writeBool(SETTINGS_KEYS.notifMsg, notifMsg);
      writeBool(SETTINGS_KEYS.notifGroup, notifGroup);
      writeBool(SETTINGS_KEYS.notifSound, notifSound);

      applyTheme(darkMode);
      applyFontSize(fontSize);
      window.dispatchEvent(new Event("app-settings-updated"));

      toast.success("Settings saved");
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const backupChats = async () => {
    setBusy(true);
    try {
      const { data } = await api.get("/messages/conversations");
      const payload = { exportedAt: new Date().toISOString(), user, conversations: data };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `chat-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(href);
      toast.success("Backup downloaded");
    } catch {
      toast.error("Backup failed");
    } finally {
      setBusy(false);
    }
  };

  const clearAllHistory = async () => {
    if (!conversations.length) return toast("No chats to clear");
    if (!window.confirm("Delete all chat history?")) return;
    setBusy(true);
    try {
      for (const c of conversations) {
        // eslint-disable-next-line no-await-in-loop
        await deleteConversation(c._id);
      }
      await fetchConversations();
      toast.success("All chats cleared");
    } catch {
      toast.error("Failed to clear chats");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-[1280px] h-[90vh] bg-[#f6f7f8] dark:bg-[#111b21] rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.35)] grid grid-cols-2">
        <aside className="h-full bg-[#eceff2] dark:bg-[#1f2c33] border-r border-gray-200 dark:border-[#2a3942] p-5 overflow-y-auto min-w-0">
          <div className="flex items-center gap-2 mb-6">
            <svg className="w-8 h-8 text-[#25d366]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.52 3.48A11.8 11.8 0 0012.05 0C5.58 0 .33 5.24.33 11.72c0 2.07.54 4.08 1.58 5.84L0 24l6.6-1.73a11.7 11.7 0 005.45 1.39h.01c6.47 0 11.72-5.25 11.72-11.73a11.62 11.62 0 00-3.26-8.45z" />
            </svg>
            <span className="text-[28px] font-semibold text-[#25d366] leading-none">WhatsApp</span>
          </div>

          <div className="space-y-1.5">
            {nav.map((n) => (
              <button
                key={n.key}
                onClick={() => setSection(n.key)}
                className={`w-full text-left rounded-xl px-3 py-3 transition ${
                  section === n.key
                    ? "bg-[#d5f5e2] dark:bg-[#2a3942]"
                    : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <p className="text-[16px] font-semibold text-[#111b21] dark:text-[#e9edef] leading-tight">{n.title}</p>
                <p className="text-[12px] text-gray-500 mt-0.5">{n.sub}</p>
              </button>
            ))}
          </div>
        </aside>

        <main className="h-full min-w-0 overflow-y-auto bg-[#f9fafb] dark:bg-[#0b141a]">
          <div className="sticky top-0 z-10 px-8 py-5 border-b border-gray-200 dark:border-[#2a3942] bg-white/95 dark:bg-[#132028]/95 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar src={user?.avatar} name={user?.username || "User"} size="xl" />
                <div className="min-w-0">
                  <p className="text-[24px] font-semibold text-[#111b21] dark:text-[#e9edef] truncate">{user?.username || "User"}</p>
                  <p className="text-[13px] text-gray-500 truncate">{user?.bio || "Available"}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-sm text-gray-600 hover:text-black dark:text-gray-300 rounded-lg px-2.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close ✕
              </button>
            </div>
          </div>

          <div className="px-8 py-6">
            <div className="max-w-[860px] bg-white dark:bg-[#1f2c33] rounded-2xl border border-gray-200 dark:border-[#2a3942] p-6">
              {section === "account" && (
                <div>
                  <h2 className="text-[30px] font-semibold text-[#111b21] dark:text-[#e9edef] mb-5">Account</h2>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#00a884]">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Avatar src={user?.avatar} name={username} size="xl" />
                        )}
                      </div>
                      <button onClick={() => avatarInputRef.current?.click()} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#00a884] text-white">+</button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setAvatarFile(file);
                          setAvatarPreview(URL.createObjectURL(file));
                          setAvatarPreset("");
                        }}
                      />
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 rounded-lg px-3 bg-[#f0f2f5] dark:bg-[#2a3942] text-sm" placeholder="Username" />
                      <input value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-lg px-3 bg-[#f0f2f5] dark:bg-[#2a3942] text-sm" placeholder="Email" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {AVATAR_PRESETS.map((p) => (
                      <button key={p} onClick={() => { setAvatarPreset(p); setAvatarPreview(p); setAvatarFile(null); }} className={`w-14 h-14 rounded-xl overflow-hidden border-2 ${avatarPreset === p ? "border-[#00a884]" : "border-transparent"}`}>
                        <img src={p} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {section === "chats" && (
                <div>
                  <h2 className="text-[30px] font-semibold text-[#111b21] dark:text-[#e9edef] mb-5">Chat</h2>
                  <SettingRow title="Theme" desc="Display" right={<Toggle value={darkMode} onChange={(v) => { setDarkMode(v); applyTheme(v); }} />} />
                  <div className="py-3 border-b border-gray-100 dark:border-[#2a3942]">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[15px] font-medium text-[#111b21] dark:text-[#e9edef]">Wallpaper</p>
                        <p className="text-sm text-gray-500">Explore all</p>
                      </div>
                      <button onClick={() => bgInputRef.current?.click()} className="text-[#00a884] text-sm underline">Upload</button>
                    </div>
                    <input
                      ref={bgInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setBgFile(file);
                        setBgPreview(URL.createObjectURL(file));
                        setBgPreset("");
                        setClearBg(false);
                      }}
                    />
                    <div className="h-24 rounded-xl border border-gray-200 dark:border-[#2a3942] overflow-hidden mb-2 bg-[#efeae2]">
                      {bgDisplay ? <img src={bgDisplay} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {BG_PRESETS.map((p) => (
                        <button key={p} onClick={() => { setBgPreset(p); setBgPreview(p); setBgFile(null); setClearBg(false); }} className={`w-12 h-8 rounded overflow-hidden border ${bgPreset === p ? "border-[#00a884]" : "border-transparent"}`}>
                          <img src={p} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                      <button onClick={() => { setBgPreset(""); setBgFile(null); setBgPreview(""); setClearBg(true); }} className="text-sm text-red-500">Remove</button>
                    </div>
                  </div>
                  <SettingRow title="Enter is send" desc="Enter key will send your message" right={<Toggle value={enterSend} onChange={setEnterSend} />} />
                  <SettingRow title="Font Size" right={
                    <select value={fontSize} onChange={(e) => { setFontSize(e.target.value); applyFontSize(e.target.value); }} className="h-9 w-40 rounded-lg px-3 border bg-transparent text-sm">
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  } />
                  <SettingRow title="Language" right={
                    <select value={language} onChange={(e) => setLanguage(e.target.value)} className="h-9 w-40 rounded-lg px-3 border bg-transparent text-sm">
                      <option>English (US)</option>
                      <option>English (UK)</option>
                      <option>Hindi</option>
                      <option>Gujarati</option>
                    </select>
                  } />
                  <SettingRow title="Chat Backup" right={<button onClick={backupChats} disabled={busy} className="text-[#00a884] text-sm underline">Backup</button>} />
                  <SettingRow title="Chat History" right={<button onClick={clearAllHistory} disabled={busy} className="text-red-500 text-sm underline">Clear all chats</button>} />
                </div>
              )}

              {section === "notifications" && (
                <div>
                  <h2 className="text-[30px] font-semibold text-[#111b21] dark:text-[#e9edef] mb-5">Notifications</h2>
                  <SettingRow title="Message Notifications" desc="Message alerts" right={<Toggle value={notifMsg} onChange={async (v) => {
                    setNotifMsg(v);
                    if (v && typeof Notification !== "undefined") {
                      try { await Notification.requestPermission(); } catch {}
                    }
                  }} />} />
                  <SettingRow title="Group Notifications" desc="Group alerts" right={<Toggle value={notifGroup} onChange={setNotifGroup} />} />
                  <SettingRow title="Notification Sounds" desc="Message sound" right={<Toggle value={notifSound} onChange={setNotifSound} />} />
                </div>
              )}

              {section === "storage" && (
                <div>
                  <h2 className="text-[30px] font-semibold text-[#111b21] dark:text-[#e9edef] mb-5">Storage & Data</h2>
                  <SettingRow title="Local App Storage" right={<span className="text-gray-500 text-sm">{storageKb} KB</span>} />
                  <SettingRow title="Conversations" right={<span className="text-gray-500 text-sm">{conversations.length}</span>} />
                  <button onClick={() => {
                    Object.values(SETTINGS_KEYS).forEach((k) => localStorage.removeItem(k));
                    toast.success("Cached settings cleared");
                  }} className="mt-3 text-sm text-red-500 underline">
                    Clear cached settings
                  </button>
                </div>
              )}

              {section === "help" && (
                <div>
                  <h2 className="text-[30px] font-semibold text-[#111b21] dark:text-[#e9edef] mb-5">Help</h2>
                  <div className="space-y-2 text-sm">
                    <a className="block text-[#00a884] underline" href="https://faq.whatsapp.com/" target="_blank" rel="noreferrer">Help Centre</a>
                    <a className="block text-[#00a884] underline" href="https://www.whatsapp.com/contact/" target="_blank" rel="noreferrer">Contact Us</a>
                    <a className="block text-[#00a884] underline" href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a>
                  </div>
                </div>
              )}
            </div>

            <div className="max-w-[860px] mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Cancel</button>
              <button onClick={saveSettings} disabled={saving} className="px-4 py-2 rounded-lg bg-[#00a884] text-white text-sm disabled:opacity-60">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
