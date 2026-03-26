import { useRef, useState } from "react";
import api from "../lib/axios";
import toast from "react-hot-toast";

const TEXT_BG_OPTIONS = [
  "#00a884", "#1a1a2e", "#e74c3c", "#8e44ad",
  "#f39c12", "#2980b9", "#16a085", "#d35400",
];

export default function StatusUpload({ onClose, onUploaded }) {
  const [mode, setMode] = useState("text"); // "text" | "media"
  const [text, setText] = useState("");
  const [textBg, setTextBg] = useState("#00a884");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const pickFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMode("media");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === "text" && !text.trim()) return toast.error("Enter some text");
    if (mode === "media" && !file) return toast.error("Pick a photo or video");
    setUploading(true);
    try {
      const fd = new FormData();
      if (text.trim()) { fd.append("text", text.trim()); fd.append("textBg", textBg); }
      if (file) fd.append("media", file);
      const { data } = await api.post("/status", fd);
      toast.success("Status posted!");
      onUploaded?.(data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to post status");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-sm bg-[#111b21] sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#202c33]">
          <h3 className="text-white font-semibold text-base">Add Status</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-700">
          {[{ k: "text", label: "✏️ Text" }, { k: "media", label: "📷 Photo/Video" }].map(({ k, label }) => (
            <button key={k} onClick={() => setMode(k)}
              className={`flex-1 py-2.5 text-sm font-medium transition border-b-2 ${
                mode === k ? "border-[#00a884] text-[#00a884]" : "border-transparent text-gray-400"
              }`}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {mode === "text" && (
            <>
              {/* Preview */}
              <div className="h-40 rounded-xl flex items-center justify-center p-4 transition-colors"
                style={{ background: textBg }}>
                <p className="text-white text-lg font-semibold text-center break-words">
                  {text || "Your status text…"}
                </p>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type your status…"
                rows={3}
                maxLength={200}
                className="w-full px-3 py-2 rounded-lg bg-[#2a3942] text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00a884] resize-none"
              />
              {/* Colour picker */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Background colour</p>
                <div className="flex gap-2 flex-wrap">
                  {TEXT_BG_OPTIONS.map((c) => (
                    <button key={c} type="button" onClick={() => setTextBg(c)}
                      className={`w-8 h-8 rounded-full border-2 transition ${textBg === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </>
          )}

          {mode === "media" && (
            <>
              {preview ? (
                <div className="relative h-48 rounded-xl overflow-hidden bg-black">
                  {file?.type.startsWith("video/") ? (
                    <video src={preview} className="w-full h-full object-contain" controls />
                  ) : (
                    <img src={preview} alt="preview" className="w-full h-full object-contain" />
                  )}
                  <button type="button" onClick={() => { setFile(null); setPreview(null); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80">
                    ✕
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full h-40 border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-[#00a884] hover:text-[#00a884] transition">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">Tap to pick photo or video</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={pickFile} />
              {/* Optional caption */}
              <input value={text} onChange={(e) => setText(e.target.value)}
                placeholder="Add a caption (optional)"
                className="w-full px-3 py-2 rounded-lg bg-[#2a3942] text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00a884]" />
            </>
          )}

          <button type="submit" disabled={uploading}
            className="w-full py-3 bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold rounded-xl text-sm disabled:opacity-60 transition">
            {uploading ? "Posting…" : "Post Status"}
          </button>
        </form>
      </div>
    </div>
  );
}
