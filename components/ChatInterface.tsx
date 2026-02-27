"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { ToolCallTraceCard } from "./ToolCallTrace";
import type { ToolCallTrace } from "@/app/api/chat/route";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  traces?: ToolCallTrace[];
  suggestedFollowUps?: string[];
};

const suggestedQuestions = [
  "How's our pipeline looking for the energy sector this quarter?",
  "What's the total value of open work orders?",
  "Which deals are at risk of missing their close date?",
  "Show me revenue breakdown by sector",
  "What's our win rate this month?"
];

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dealsStatus, setDealsStatus] = useState<"checking" | "connected" | "error">(
    "checking"
  );
  const [workOrdersStatus, setWorkOrdersStatus] = useState<
    "checking" | "connected" | "error"
  >("checking");

  useEffect(() => {
    const checkBoard = async (
      boardKind: "deals" | "work_orders",
      setStatus: (s: "checking" | "connected" | "error") => void
    ) => {
      try {
        const res = await fetch("/api/monday", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardKind })
        });
        if (res.ok) {
          setStatus("connected");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };

    void checkBoard("deals", setDealsStatus);
    void checkBoard("work_orders", setWorkOrdersStatus);
  }, []);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content
    };

    const assistantId = String(Date.now() + 1);

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        traces: [],
        suggestedFollowUps: []
      }
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        const errorMsg =
          "The BI agent ran into an error while calling Monday.com or OpenAI. " +
          "Please check your env vars and try again.\n\n" +
          errorText;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: errorMsg
                }
              : m
          )
        );
        return;
      }

      if (!res.body) {
        throw new Error("No response body from chat endpoint");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let tracesApplied = false;

      // Protocol:
      // data: TRACES:<json>\n\n
      // data: <chunk>\n\n
      // ...
      // data: [DONE]\n\n
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;

          if (payload === "[DONE]") {
            break;
          }

          if (payload.startsWith("TRACES:") && !tracesApplied) {
            const jsonStr = payload.slice("TRACES:".length);
            try {
              const parsed = JSON.parse(jsonStr) as {
                traces: ToolCallTrace[];
                suggestedFollowUps?: string[];
              };
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        traces: parsed.traces ?? [],
                        suggestedFollowUps: parsed.suggestedFollowUps ?? []
                      }
                    : m
                )
              );
              tracesApplied = true;
            } catch {
              // Ignore malformed trace payloads
            }
            continue;
          }

          // Treat as content chunk
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: (m.content ?? "") + payload
                  }
                : m
            )
          );
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  "Network error while contacting the BI agent. Please check your connection and try again.\n\n" +
                  (err?.message ?? String(err))
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const hasMessages = messages.length > 0;
  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  const resetConversation = () => {
    setMessages([]);
    setInput("");
  };

  const renderStatusDot = (status: "checking" | "connected" | "error") => {
    const base = "inline-flex h-2 w-2 rounded-full";
    if (status === "checking") {
      return <span className={cn(base, "bg-gray-500 animate-pulse")} />;
    }
    if (status === "connected") {
      return <span className={cn(base, "bg-emerald-500 animate-pulse")} />;
    }
    return <span className={cn(base, "bg-red-500")} />;
  };

  return (
    <div className="flex h-screen">
      <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-gray-800 p-4">
        <div className="mb-6">
          <h1 className="text-sm font-semibold text-gray-200">Monday BI Agent</h1>
          <p className="text-[11px] text-gray-500">
            Founder-level insights over your Monday.com pipeline and work orders.
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-100">Deals Board</div>
              <div className="text-[11px] text-gray-500 truncate">
                {dealsStatus === "connected"
                  ? "Live connection"
                  : dealsStatus === "checking"
                  ? "Checking connection…"
                  : "Not connected"}
              </div>
            </div>
            {renderStatusDot(dealsStatus)}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-100">Work Orders Board</div>
              <div className="text-[11px] text-gray-500 truncate">
                {workOrdersStatus === "connected"
                  ? "Live connection"
                  : workOrdersStatus === "checking"
                  ? "Checking connection…"
                  : "Not connected"}
              </div>
            </div>
            {renderStatusDot(workOrdersStatus)}
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={resetConversation}
            className="text-[11px] px-3 py-1 rounded-md border border-gray-700 text-gray-200 hover:bg-gray-900 bg-transparent"
          >
            New conversation
          </button>
          <a
            href="/decision-log"
            className="text-[11px] text-gray-500 hover:text-gray-200 underline underline-offset-2"
          >
            Decision Log
          </a>
        </div>
        <div className="mt-auto pt-4 text-[11px] text-gray-600 border-t border-gray-800">
          Live Monday.com calls only. No data is cached.
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-background">
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-4">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-gray-100">
              Founder BI assistant
            </h2>
            <p className="text-xs text-gray-500">
              Ask natural questions about your pipeline and work orders. I&apos;ll call
              Monday.com live and handle messy data for you.
            </p>
          </div>

          {!hasMessages && (
            <div className="mb-4 flex flex-wrap gap-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="text-xs px-3 py-1 rounded-full border border-gray-700 bg-card/60 hover:bg-gray-900 text-gray-200"
                  onClick={() => handleSend(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto border border-gray-800 rounded-lg bg-black/20 p-4 mb-3">
            {messages.map((m, index) => (
              <div key={m.id} className="mb-1">
                <MessageBubble role={m.role}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </MessageBubble>
                {m.role === "assistant" && m.traces && m.traces.length > 0 && (
                  <div className={cn("ml-0 md:ml-4 max-w-[80%]")}>
                    {m.traces.map((t) => (
                      <ToolCallTraceCard key={t.id} trace={t} />
                    ))}
                  </div>
                )}
                {m.role === "assistant" &&
                  index === lastAssistantIndex &&
                  m.suggestedFollowUps &&
                  m.suggestedFollowUps.length > 0 && (
                    <div className="mt-2 ml-0 md:ml-4 flex flex-wrap gap-2">
                      {m.suggestedFollowUps.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className="text-[11px] px-3 py-1 rounded-full border border-gray-700 bg-card/60 hover:bg-gray-900 text-gray-200"
                          onClick={() => handleSend(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ))}
            {loading && <TypingIndicator />}
            {!hasMessages && !loading && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md text-xs text-gray-400">
                  <div className="mb-2 text-sm font-semibold text-gray-100">
                    Ask founder-level BI questions
                  </div>
                  <p className="mb-2">
                    I&apos;ll pull live data from your Monday.com Deals and Work Orders
                    boards, normalize messy values, and give you concise, executive-ready
                    insights.
                  </p>
                  <p>
                    Try asking about pipeline health, at-risk deals, revenue by sector, or
                    the value of open work orders.
                  </p>
                </div>
              </div>
            )}
          </div>

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <input
              className="flex-1 rounded-md border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Ask something like “How's our pipeline looking for the energy sector this quarter?”"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-md bg-accent text-xs font-medium text-white hover:bg-accentSoft disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Thinking..." : "Send"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

