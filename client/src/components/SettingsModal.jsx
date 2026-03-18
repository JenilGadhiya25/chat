import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/authStore";
import { SERVER_URL } from "../lib/axios";

const resolveUrl = (url) =>
  url?.startsWith("http") ? url : url?.startsWith("/presets/") ? url : `${SERVER_URL}${url}`;
const AVATAR_PRESETS = [
  "/presets/avatars/avatar-1.svg",
  "/presets/avatars/avatar-2.svg",
  "/presets/avatars/avatar-3.svg",
];
const BACKGROUND_PRESETS = [
  "/presets/backgrounds/bg-1.svg",
  "/presets/backgrounds/bg-2.svg",
  "/presets/backgrounds/bg-3.svg",
];

export default function SettingsModal({ open, onClose }) {
  const { user, updateProfile } = useAuthStore();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatarPreset, setAvatarPreset] = useState("");
  const [bgPreset, setBgPreset] = useState("");
  const [clearBackground, setClearBackground] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsername(user?.username || "");
    setEmail(user?.email || "");
    setAvatarPreset(AVATAR_PRESETS.includes(user?.avatar) ? user.avatar : "");
    setBgPreset(BACKGROUND_PRESETS.includes(user?.chatBackground) ? user.chatBackground : "");
    setClearBackground(false);
  }, [open, user]);

  const avatarPreview = useMemo(
    () => (avatarPreset ? avatarPreset : user?.avatar ? resolveUrl(user.avatar) : ""),
    [avatarPreset, user?.avatar]
  );

  const backgroundPreview = useMemo(() => {
    if (bgPreset) return bgPreset;
    if (clearBackground) return "";
    return user?.chatBackground ? resolveUrl(user.chatBackground) : "";
  }, [bgPreset, clearBackground, user?.chatBackground]);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("username", username.trim());
      formData.append("email", email.trim());
      if (avatarPreset) formData.append("avatarPreset", avatarPreset);
      if (bgPreset) formData.append("backgroundPreset", bgPreset);
      if (clearBackground) formData.append("clearBackground", "true");

      await updateProfile(formData);
      toast.success("Profile updated");
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSave}
        className="w-full max-w-2xl bg-[var(--wa-panel)] rounded-xl shadow-xl border border-[var(--wa-border)] overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[var(--wa-border)] bg-[var(--wa-panel-muted)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--wa-text)]">Settings</h2>
          <button type="button" onClick={onClose} className="text-[var(--wa-subtext)] hover:text-[var(--wa-text)]">✕</button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--wa-subtext)] mb-1">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-[var(--wa-input-border)] bg-[var(--wa-input-bg)] text-[var(--wa-text)] focus:outline-none focus:ring-2 focus:ring-[#00a884]/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--wa-subtext)] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-[var(--wa-input-border)] bg-[var(--wa-input-bg)] text-[var(--wa-text)] focus:outline-none focus:ring-2 focus:ring-[#00a884]/30"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--wa-subtext)] mb-2">Profile Photo</label>
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={avatarPreview || "https://placehold.co/64x64/e5e7eb/64748b?text=U"}
                  alt="avatar"
                  className="w-16 h-16 rounded-full object-cover border border-gray-200"
                />
                <span className="text-xs text-[var(--wa-subtext)]">Choose a default avatar</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAvatarPreset(preset)}
                    className={`p-1 rounded-lg border ${avatarPreview === preset ? "border-[#00a884]" : "border-[var(--wa-border)]"}`}
                  >
                    <img src={preset} alt="avatar option" className="w-full h-16 object-cover rounded-md" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wa-subtext)] mb-2">Chat Background Photo</label>
              <div className="space-y-2">
                <div className="h-24 rounded-lg border border-[var(--wa-border)] bg-[#efeae2] overflow-hidden">
                  {backgroundPreview ? (
                    <img src={backgroundPreview} alt="background preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-[var(--wa-subtext)]">No background selected</div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {BACKGROUND_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setBgPreset(preset);
                        setClearBackground(false);
                      }}
                      className={`p-1 rounded-lg border ${bgPreset === preset ? "border-[#00a884]" : "border-[var(--wa-border)]"}`}
                    >
                      <img src={preset} alt="background option" className="w-full h-12 object-cover rounded-md" />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBgPreset("");
                    setClearBackground(true);
                  }}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove background
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--wa-border)] bg-[var(--wa-panel)] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--wa-input-border)] text-[var(--wa-subtext)] hover:bg-[var(--wa-hover)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#00a884] text-white hover:bg-[#029477] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
