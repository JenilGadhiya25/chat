import { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/axios";

export default function AiChatPanel({ onClose }) {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      type: "text",
      content: "Hi! I am your AI assistant. Ask me anything or generate an image.",
    },
  ]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [aiReady, setAiReady] = useState(true);
  const [configMessage, setConfigMessage] = useState("");
  const endRef = useRef(null);

  const historyForApi = useMemo(
    () =>
      messages
        .filter((m) => m.type === "text")
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-16),
    [messages]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, imgLoading]);

  useEffect(() => {
    let mounted = true;
    const checkConfig = async () => {
      setCheckingConfig(true);
      try {
        const { data } = await api.get("/ai/status");
        if (!mounted) return;
        const ready = Boolean(data?.configured);
        setAiReady(ready);
        setConfigMessage(
          ready
            ? ""
            : "AI is not configured. Add OPENAI_API_KEY in server/.env and restart server."
        );
      } catch {
        if (!mounted) return;
        setAiReady(false);
        setConfigMessage("Could not reach AI service. Please check server status.");
      } finally {
        if (mounted) setCheckingConfig(false);
      }
    };
    checkConfig();
    return () => { mounted = false; };
  }, []);

  const appendAssistantText = (content) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && last?.type === "text" && last?.content === content) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          type: "text",
          content,
        },
      ];
    });
  };

  const pushUserText = (value) => {
    const msg = {
      id: `${Date.now()}-${Math.random()}`,
      role: "user",
      type: "text",
      content: value,
    };
    setMessages((prev) => [...prev, msg]);
  };

  const askAi = async () => {
    const value = text.trim();
    if (!value || loading || imgLoading || !aiReady) return;
    setText("");
    pushUserText(value);
    setLoading(true);
    try {
      const nextHistory = [...historyForApi, { role: "user", content: value }];
      const { data } = await api.post("/ai/chat", { messages: nextHistory });
      appendAssistantText(data?.text || "I could not generate a response right now.");
    } catch (err) {
      const msg = err?.response?.data?.message || "AI request failed. Please try again.";
      if (msg.toLowerCase().includes("openai_api_key")) {
        setAiReady(false);
        setConfigMessage("AI is not configured. Add OPENAI_API_KEY in server/.env and restart server.");
      }
      appendAssistantText(msg);
    } finally {
      setLoading(false);
    }
  };

  const generateImage = async () => {
    const prompt = text.trim();
    if (!prompt || loading || imgLoading || !aiReady) return;
    setText("");
    pushUserText(`Generate image: ${prompt}`);
    setImgLoading(true);
    try {
      const { data } = await api.post("/ai/image", { prompt });
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-img`,
          role: "assistant",
          type: "image",
          content: data?.imageUrl,
          prompt,
        },
      ]);
    } catch (err) {
      const msg = err?.response?.data?.message || "Image generation failed.";
      if (msg.toLowerCase().includes("openai_api_key")) {
        setAiReady(false);
        setConfigMessage("AI is not configured. Add OPENAI_API_KEY in server/.env and restart server.");
      }
      appendAssistantText(msg);
    } finally {
      setImgLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0b141a]">
      <div className="h-[56px] sm:h-[60px] px-3 sm:px-4 border-b border-[#213039] bg-[#202c33] flex items-center justify-between">
        <div>
          <p className="text-[#e9edef] font-semibold">Meta AI</p>
          <p className="text-[11px] text-[#8696a0]">Ask questions or generate images</p>
        </div>
        <button onClick={onClose} className="text-[#aebac1] hover:text-white text-sm">Close</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {!aiReady && (
          <div className="rounded-xl bg-[#2a3942] border border-[#3c4f5a] text-[#d1d7db] text-sm px-3 py-2">
            {configMessage}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] sm:max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-[#005c4b] text-[#e9edef]"
                  : "bg-[#202c33] text-[#d1d7db]"
              }`}
            >
              {m.type === "image" && m.content ? (
                <div>
                  <img src={m.content} alt={m.prompt || "AI generated"} className="rounded-xl max-h-[320px] object-cover" />
                  {m.prompt ? <p className="text-xs mt-2 text-[#aebac1]">{m.prompt}</p> : null}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {(loading || imgLoading) && (
          <div className="text-xs text-[#8696a0]">{imgLoading ? "Generating image..." : "AI is typing..."}</div>
        )}
        {checkingConfig && (
          <div className="text-xs text-[#8696a0]">Checking AI configuration...</div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-2.5 sm:p-3 border-t border-[#213039] bg-[#1f2c33]">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && askAi()}
            placeholder={
              aiReady
                ? "Ask Meta AI or write an image prompt..."
                : "Configure OPENAI_API_KEY in server/.env to enable AI"
            }
            disabled={!aiReady || checkingConfig}
            className="flex-1 h-11 px-4 rounded-xl bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] focus:outline-none"
          />
          <button
            onClick={generateImage}
            disabled={!text.trim() || loading || imgLoading || !aiReady || checkingConfig}
            className="h-11 px-3 rounded-xl bg-[#374248] text-[#d1d7db] hover:bg-[#415058] disabled:opacity-50 whitespace-nowrap"
            title="Generate image"
          >
            Image
          </button>
          <button
            onClick={askAi}
            disabled={!text.trim() || loading || imgLoading || !aiReady || checkingConfig}
            className="h-11 px-4 rounded-xl bg-[#00a884] text-white hover:bg-[#009377] disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
