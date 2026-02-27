export function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400 px-3 py-2">
      <span className="inline-flex h-2 w-2 rounded-full bg-accent animate-pulse" />
      <span>Agent is thinking...</span>
    </div>
  );
}

