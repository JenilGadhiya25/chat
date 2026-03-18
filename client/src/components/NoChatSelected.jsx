export default function NoChatSelected() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center chat-bg-pattern text-center p-8">
      <div className="w-16 h-16 rounded-full bg-[var(--wa-panel)] shadow-sm border border-[var(--wa-border)] flex items-center justify-center text-3xl mb-4">💬</div>
      <h2 className="text-xl font-semibold text-[var(--wa-text)]">WhatsApp Web Style</h2>
      <p className="text-[var(--wa-subtext)] mt-2 text-sm max-w-xs">
        Select a chat from the sidebar to start messaging.
      </p>
    </div>
  );
}
