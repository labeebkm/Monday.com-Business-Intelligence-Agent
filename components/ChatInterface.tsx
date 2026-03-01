"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ToolCallTrace } from "@/app/api/chat/route";

type BoardStatus = "checking" | "connected" | "error";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  typing?: boolean;
  traces?: ToolCallTrace[];
  suggestedFollowUps?: string[];
};

const SUGGESTED_QUESTIONS = [
  "Give me a full pipeline overview",
  "How is the Mining sector performing?",
  "What is our billing and receivables health?",
  "Which deals are closing in the next 60 days?",
  "Show work order execution status across all sectors",
  "Revenue breakdown by sector from work orders",
  "Team performance ranked by BD owner",
  "Which completed work orders have not been billed yet?"
];

const CHAT_INTERFACE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=JetBrains+Mono:wght@400;600&family=DM+Sans:wght@400;500;600&display=swap');

  :root {
    --bg: #070a0f;
    --surface-0: #0c0f16;
    --surface-1: #111520;
    --surface-2: #161b28;
    --border: #1e2535;
    --border-subtle: #181f30;
    --accent: #6366f1;
    --accent-2: #818cf8;
    --accent-dim: rgba(99,102,241,0.12);
    --text-primary: #f1f5f9;
    --text-secondary: #94a3b8;
    --text-muted: #475569;
    --font-display: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .bi-shell { background: var(--bg); color: var(--text-primary); font-family: var(--font-body); }
  .bi-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
  .bi-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

  .bi-chip:hover { background: var(--accent-dim); border-color: var(--accent); color: var(--text-primary); }
  .bi-follow:hover { background: var(--accent); color: #fff; }
  .bi-send:hover { transform: translateY(-1px); }
  .bi-pill {
    padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border-subtle);
    color: var(--text-secondary); background: var(--surface-1); font-family: var(--font-mono);
  }

  .bi-md h2, .bi-md h3 { font-family: var(--font-display); margin: 10px 0 6px; }
  .bi-md h2 { font-size: 15px; }
  .bi-md h3 { font-size: 13px; }
  .bi-md p { margin: 4px 0; color: var(--text-secondary); }
  .bi-md ul { margin: 6px 0 6px 18px; color: var(--text-secondary); }
  .bi-md table { width: 100%; border-collapse: collapse; margin: 10px 0; border: 1px solid var(--border-subtle); }
  .bi-md th, .bi-md td { border-bottom: 1px solid var(--border-subtle); padding: 7px 9px; font-size: 12px; text-align: left; }
  .bi-md th { background: var(--accent-dim); color: var(--accent); }
  .bi-md tr:last-child td { border-bottom: none; }

  @keyframes typingBounce { 0%,60%,100% { transform: translateY(0);} 30% { transform: translateY(-5px);} }
  @keyframes pulse { 0%,100% { opacity: 1;} 50% { opacity: 0.4;} }
  @keyframes spin { from { stroke-dashoffset: 60; } to { stroke-dashoffset: -60; } }

  @media (max-width: 960px) {
    .bi-header-pad, .bi-chat-pad, .bi-input-pad { padding-left: 14px !important; padding-right: 14px !important; }
  }
`;

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function StatusDot({ status }: { status: BoardStatus }) {
  const colorMap: Record<BoardStatus, string> = {
    connected: "#22c55e",
    checking: "#f59e0b",
    error: "#ef4444"
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: colorMap[status],
        boxShadow: status === "connected" ? `0 0 6px ${colorMap.connected}80` : "none",
        animation: status === "checking" ? "pulse 1.5s infinite" : "none"
      }}
    />
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--accent)",
            animation: "typingBounce 1.3s infinite ease-in-out",
            animationDelay: `${i * 0.16}s`
          }}
        />
      ))}
    </div>
  );
}

function TraceCard({ trace }: { trace: ToolCallTrace }) {
  const [open, setOpen] = useState(false);
  const normalized = trace.normalizationSummary;

  return (
    <div
      style={{
        marginTop: 8,
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        background: "var(--surface-2)",
        overflow: "hidden"
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          color: "var(--text-secondary)",
          padding: "8px 10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          textAlign: "left"
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ color: "var(--accent)", flexShrink: 0 }}>
            <IconSpark />
          </span>
          <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", flexShrink: 0 }}>
            {trace.name}
          </span>
          <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            - {trace.endpoint}
          </span>
        </span>
        <IconChevron open={open} />
      </button>
      {open && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: 10, fontSize: 11 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>Parameters</div>
            <pre
              style={{
                margin: 0,
                padding: 8,
                borderRadius: 6,
                border: "1px solid var(--border-subtle)",
                background: "var(--surface-0)",
                color: "var(--text-secondary)",
                overflow: "auto"
              }}
            >
              {JSON.stringify(trace.args, null, 2)}
            </pre>
          </div>
          {normalized && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <span className="bi-pill">rows: {normalized.totalItems}</span>
              <span className="bi-pill">nulls: {normalized.nullValues}</span>
              <span className="bi-pill">dates: {normalized.normalizedDates}</span>
              <span className="bi-pill">numbers: {normalized.normalizedNumbers}</span>
            </div>
          )}
          {trace.error && <div style={{ color: "#ef4444" }}>{trace.error}</div>}
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 12 }}>
      <div
        style={{
          borderRadius: "4px 14px 14px 14px",
          padding: "10px 14px",
          background: "var(--surface-1)",
          border: "1px solid var(--border-subtle)",
          maxWidth: "88%"
        }}
      >
        <TypingDots />
      </div>
    </div>
  );
}

const MessageList = memo(function MessageList({
  messages,
  loading,
  lastAssistantIndex,
  onFollowUp
}: {
  messages: ChatMessage[];
  loading: boolean;
  lastAssistantIndex: number;
  onFollowUp: (q: string) => void;
}) {
  return (
    <>
      {messages.map((m, index) => {
        const isUser = m.role === "user";
        const isLastAssistant = index === lastAssistantIndex;
        return (
          <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 14 }}>
            {!isUser && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, color: "var(--text-muted)", fontSize: 11 }}>
                <IconSpark />
                BI Agent
              </div>
            )}
            <div
              style={{
                maxWidth: isUser ? "72%" : "88%",
                borderRadius: isUser ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
                padding: isUser ? "10px 14px" : "13px 14px",
                background: isUser ? "linear-gradient(135deg, var(--accent), var(--accent-2))" : "var(--surface-1)",
                border: isUser ? "none" : "1px solid var(--border-subtle)"
              }}
            >
              {m.typing ? (
                <TypingDots />
              ) : isUser ? (
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              ) : (
                <div className="bi-md">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
            {!isUser && m.traces && m.traces.length > 0 && !m.typing && (
              <div style={{ width: "88%" }}>
                {m.traces.map((trace) => (
                  <TraceCard key={trace.id} trace={trace} />
                ))}
              </div>
            )}
            {!isUser &&
              isLastAssistant &&
              m.suggestedFollowUps &&
              m.suggestedFollowUps.length > 0 &&
              !m.typing && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, maxWidth: "88%" }}>
                  {m.suggestedFollowUps.map((question) => (
                    <button
                      key={question}
                      className="bi-follow"
                      onClick={() => onFollowUp(question)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--accent)",
                        background: "var(--accent-dim)",
                        color: "var(--accent)",
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              )}
          </div>
        );
      })}
      {loading && <TypingIndicator />}
    </>
  );
});
export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [dealsStatus, setDealsStatus] = useState<BoardStatus>("checking");
  const [workOrdersStatus, setWorkOrdersStatus] = useState<BoardStatus>("checking");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)");
    const sync = () => setSidebarOpen(!media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const checkBoard = async (
      boardKind: "deals" | "work_orders",
      setStatus: (status: BoardStatus) => void
    ) => {
      try {
        const res = await fetch("/api/monday", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardKind })
        });
        setStatus(res.ok ? "connected" : "error");
      } catch {
        setStatus("error");
      }
    };

    void checkBoard("deals", setDealsStatus);
    void checkBoard("work_orders", setWorkOrdersStatus);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text ?? inputRef.current?.value ?? "").trim();
      if (!content || loading) return;
      if (inputRef.current) inputRef.current.value = "";

      const userMessage: ChatMessage = { id: makeId(), role: "user", content };
      const assistantId = makeId();
      const placeholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        typing: true,
        traces: [],
        suggestedFollowUps: []
      };

      const requestMessages = [
        ...messages.filter((m) => !m.typing).map((m) => ({ role: m.role, content: m.content })),
        { role: userMessage.role, content: userMessage.content }
      ];

      setMessages((prev) => [...prev, userMessage, placeholder]);
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: requestMessages })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Chat request failed.");
        }

        if (!res.body) {
          throw new Error("No response body from chat endpoint.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let done = false;
        let tracesApplied = false;

        while (!done) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;

            if (payload === "[DONE]") {
              done = true;
              break;
            }

            if (payload.startsWith("TRACES:") && !tracesApplied) {
              try {
                const parsed = JSON.parse(payload.slice("TRACES:".length)) as {
                  traces?: ToolCallTrace[];
                  suggestedFollowUps?: string[];
                };
                const parsedTraces = parsed.traces ?? [];

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? {
                          ...msg,
                          traces: parsedTraces,
                          suggestedFollowUps: parsed.suggestedFollowUps ?? []
                        }
                      : msg
                  )
                );



                tracesApplied = true;
              } catch {
                // Keep streaming even if trace payload is malformed.
              }
              continue;
            }

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: (msg.content ?? "") + payload
                    }
                  : msg
              )
            );
          }
        }

        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantId ? { ...msg, typing: false } : msg))
        );
      } catch (err: unknown) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  typing: false,
                  content:
                    "The BI agent ran into an error while calling Monday.com or Groq.\n\n" +
                    errorMessage(err)
                }
              : msg
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [loading, messages]
  );

  const resetConversation = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CHAT_INTERFACE_STYLES }} />

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }}
      />

      <div className="bi-shell" style={{ position: "relative", zIndex: 1, display: "flex", height: "100vh" }}>
        <aside
          style={{
            width: sidebarOpen ? 240 : 0,
            minWidth: sidebarOpen ? 240 : 0,
            overflow: "hidden",
            transition: "width 0.25s ease, min-width 0.25s ease",
            background: "var(--surface-0)",
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>Monday BI Agent</div>
            <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Live pipeline intelligence</div>
          </div>
          <div style={{ padding: 14, borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>
              Data Sources
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Deals Board</span>
              <StatusDot status={dealsStatus} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Work Orders</span>
              <StatusDot status={workOrdersStatus} />
            </div>
          </div>
          <div style={{ padding: 14 }}>
            <button
              onClick={resetConversation}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
                background: "none",
                color: "var(--text-secondary)",
                cursor: "pointer"
              }}
            >
              <IconMenu />
              New conversation
            </button>
          </div>
          <div style={{ marginTop: "auto", padding: 14, borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)" }}>
            Live Monday.com data - no cache
          </div>
        </aside>

        <main className="bi-scroll" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header
            className="bi-header-pad"
            style={{
              height: 56,
              padding: "0 22px",
              borderBottom: "1px solid var(--border)",
              background: "var(--surface-0)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                style={{
                  border: "1px solid var(--border-subtle)",
                  background: "none",
                  borderRadius: 6,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  width: 30,
                  height: 30,
                  display: "grid",
                  placeItems: "center"
                }}
              >
                <IconMenu />
              </button>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>Founder BI Assistant</div>
                <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Natural language over live Monday data</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <StatusDot status={dealsStatus === "connected" && workOrdersStatus === "connected" ? "connected" : "checking"} />
              <span style={{ color: "#22c55e", fontSize: 11 }}>
                {dealsStatus === "connected" && workOrdersStatus === "connected" ? "Live" : "Connecting"}
              </span>
            </div>
          </header>

          <div className="bi-chat-pad bi-scroll" style={{ flex: 1, overflow: "auto", padding: "20px 22px" }}>
            {messages.length === 0 ? (
              <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
                <div style={{ maxWidth: 760, textAlign: "center" }}>
                  <div style={{ margin: "0 auto 12px", width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, var(--accent), var(--accent-2))", display: "grid", placeItems: "center" }}>
                    <IconSpark />
                  </div>
                  <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, marginBottom: 8 }}>Ask about your business data</h1>
                  <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
                    Live insights from Deals and Work Orders with trace visibility and deterministic metrics.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                    {SUGGESTED_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        className="bi-chip"
                        onClick={() => void handleSend(question)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 999,
                          border: "1px solid var(--border)",
                          background: "var(--surface-1)",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          transition: "all 0.15s"
                        }}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ maxWidth: 780, margin: "0 auto", width: "100%" }}>
                <MessageList
                  messages={messages}
                  loading={loading}
                  lastAssistantIndex={lastAssistantIndex}
                  onFollowUp={(q) => void handleSend(q)}
                />
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="bi-input-pad" style={{ padding: "14px 22px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-0)" }}>
            <div style={{ maxWidth: 780, margin: "0 auto" }}>
              {messages.length > 0 && !loading && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {SUGGESTED_QUESTIONS.slice(0, 4).map((question) => (
                    <button
                      key={question}
                      className="bi-chip"
                      onClick={() => void handleSend(question)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--border-subtle)",
                        background: "var(--surface-1)",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea
                  ref={inputRef}
                  defaultValue=""
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  onInput={(e) => {
                    const target = e.currentTarget;
                    target.style.height = "auto";
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                  }}
                  placeholder="Ask about pipeline health, receivables, sector performance, or work orders..."
                  rows={1}
                  style={{
                    flex: 1,
                    resize: "none",
                    maxHeight: 120,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface-1)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                    padding: "11px 13px",
                    lineHeight: 1.5
                  }}
                />
                <button
                  className="bi-send"
                  onClick={() => void handleSend()}
                  disabled={loading}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    border: "none",
                    display: "grid",
                    placeItems: "center",
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    color: loading ? "var(--text-muted)" : "#fff",
                    background:
                      loading
                        ? "var(--surface-2)"
                        : "linear-gradient(135deg, var(--accent), var(--accent-2))"
                  }}
                >
                  {loading ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="60" style={{ animation: "spin 1s linear infinite" }}>
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  ) : (
                    <IconSend />
                  )}
                </button>
              </div>
              <div style={{ marginTop: 7, textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>
                Live Monday.com data - Enter to send - Shift+Enter for new line
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}






