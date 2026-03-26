import { useState, useRef } from "react";
import { useChatStore } from "../store/chatStore";
import Avatar from "./Avatar";

export default function CreateGroupModal({ users, onClose }) {
  const { createGroup } = useChatStore();
  const [step, setStep] = useState(1); // 1=pick members, 2=group details
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const fileRef = useRef(null);

  const toggle = (u) => {
    setSelected((prev) =>
      prev.find((x) => x._id === u._id)
        ? prev.filter((x) => x._id !== u._id)
        : [...prev, u]
    );
  };

  const handleAvatar = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selected.length < 1) return;
    setLoading(true);
    try {
      await createGroup(
        groupName.trim(),
        selected.map((u) => u._id),
        avatarFile,
        groupDesc.trim()
      );
      onClose();
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111b21] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#202c33]">
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-[#aebac1]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-[#e9edef] font-semibold text-lg flex-1">
            {step === 1 ? "Add Participants" : "New Group"}
          </h2>
          {step === 1 && selected.length > 0 && (
            <button onClick={() => setStep(2)}
              className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center hover:bg-[#02c39a] transition">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>


        {/* Step 1: Pick members */}
        {step === 1 && (
          <>
            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-[#202c33]">
                {selected.map((u) => (
                  <div key={u._id} className="flex items-center gap-1.5 bg-[#202c33] rounded-full px-3 py-1">
                    <div className="w-5 h-5 rounded-full overflow-hidden">
                      <Avatar src={u.avatar} name={u.username} size="sm" />
                    </div>
                    <span className="text-[#e9edef] text-xs">{u.username}</span>
                    <button onClick={() => toggle(u)} className="text-[#8696a0] hover:text-white ml-0.5">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Search */}
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 bg-[#202c33] rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-[#8696a0]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts" className="flex-1 bg-transparent text-sm text-white placeholder-[#8696a0] focus:outline-none" />
              </div>
            </div>
            {/* User list */}
            <div className="flex-1 overflow-y-auto">
              {filtered.map((u) => {
                const isSelected = selected.some((x) => x._id === u._id);
                return (
                  <div key={u._id} onClick={() => toggle(u)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#202c33] transition">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                      <Avatar src={u.avatar} name={u.username} size="lg" />
                    </div>
                    <span className="flex-1 text-[#e9edef] text-[15px]">{u.username}</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                      isSelected ? "bg-[#00a884] border-[#00a884]" : "border-[#8696a0]"
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}


        {/* Step 2: Group details */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Avatar picker */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative cursor-pointer" onClick={() => fileRef.current?.click()}>
                <div className="w-24 h-24 rounded-full overflow-hidden bg-[#202c33] flex items-center justify-center border-2 border-[#2a3942]">
                  {avatarPreview
                    ? <img src={avatarPreview} alt="group" className="w-full h-full object-cover" />
                    : <svg className="w-10 h-10 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                  }
                </div>
                <div className="absolute bottom-0 right-0 w-7 h-7 bg-[#00a884] rounded-full flex items-center justify-center border-2 border-[#111b21]">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
              <p className="text-[#8696a0] text-xs">Tap to add group icon</p>
            </div>

            {/* Group name */}
            <div className="border-b border-[#00a884]">
              <input value={groupName} onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name" maxLength={50}
                className="w-full bg-transparent text-[#e9edef] text-[15px] py-2 focus:outline-none placeholder-[#8696a0]" />
            </div>
            <p className="text-right text-xs text-[#8696a0]">{groupName.length}/50</p>

            {/* Description */}
            <div className="border-b border-[#2a3942]">
              <input value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)}
                placeholder="Group description (optional)" maxLength={100}
                className="w-full bg-transparent text-[#e9edef] text-[15px] py-2 focus:outline-none placeholder-[#8696a0]" />
            </div>

            {/* Participants summary */}
            <div>
              <p className="text-xs text-[#8696a0] uppercase tracking-wider mb-2">
                Participants: {selected.length}
              </p>
              <div className="flex flex-wrap gap-2">
                {selected.map((u) => (
                  <div key={u._id} className="flex items-center gap-1.5 bg-[#202c33] rounded-full px-3 py-1">
                    <div className="w-5 h-5 rounded-full overflow-hidden">
                      <Avatar src={u.avatar} name={u.username} size="sm" />
                    </div>
                    <span className="text-[#e9edef] text-xs">{u.username}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer for step 2 */}
        {step === 2 && (
          <div className="px-5 py-4 border-t border-[#202c33] flex gap-3">
            <button onClick={() => setStep(1)}
              className="flex-1 py-2.5 rounded-xl border border-[#2a3942] text-[#8696a0] hover:bg-[#202c33] transition text-sm font-medium">
              Back
            </button>
            <button onClick={handleCreate} disabled={!groupName.trim() || loading}
              className="flex-1 py-2.5 rounded-xl bg-[#00a884] text-white font-medium text-sm hover:bg-[#02c39a] transition disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Creating..." : "Create Group"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
