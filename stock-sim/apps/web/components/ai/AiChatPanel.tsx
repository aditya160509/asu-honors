"use client";

import * as React from "react";
import { Check, Copy, Database, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { AiMarkdown } from "@/components/ai/AiMarkdown";
import { useRelativeTime } from "@/lib/ai/useRelativeTime";
import {
  AiChatStreamError,
  streamAiChat,
  type AiChatMessage,
  type AiChatScope,
} from "@/lib/api/hooks/useAi";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS: Record<AiChatScope, string[]> = {
  portfolio: [
    "What's driving my portfolio's performance today?",
    "How diversified are my holdings?",
    "What are the biggest risks in my current positions?",
  ],
  market: [
    "What phase of the economic cycle are we in right now?",
    "Explain what a Sharpe ratio tells me",
    "Summarize how interest rates affect stock valuations",
  ],
};

const SCOPES: { value: AiChatScope; label: string }[] = [
  { value: "portfolio", label: "Portfolio" },
  { value: "market", label: "Market" },
];

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: string;
  retryAfterSeconds?: number | null;
  /** Set once streaming finishes -- used for the relative timestamp and to
   * gate the copy button (no point copying a still-streaming answer). */
  completedAt?: number;
  /** Whether the opt-in context toggle was on for this specific turn. */
  usedContext?: boolean;
}

function useCountdown(seconds: number | null | undefined) {
  const [remaining, setRemaining] = React.useState(seconds ?? 0);
  React.useEffect(() => {
    setRemaining(seconds ?? 0);
  }, [seconds]);
  React.useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => (r > 1 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps -- interval only needs to exist while counting
  return remaining;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="flex items-center gap-1 text-micro text-mer-ink-tertiary hover:text-mer-ink-secondary"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ChatBubble({ turn }: { turn: ChatTurn }) {
  const countdown = useCountdown(turn.error ? turn.retryAfterSeconds : null);
  const relativeTime = useRelativeTime(turn.completedAt ?? null);
  const isStreamingThisTurn = turn.role === "assistant" && !turn.error && turn.completedAt == null;

  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-mer-md border border-[color:var(--mer-stroke-hairline)] bg-mer-surface-3 px-3 py-2 text-body text-mer-ink-primary">
          {turn.content}
        </p>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-mer-md border border-[color:var(--mer-stroke-hairline)] bg-mer-surface-2 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-micro font-medium uppercase tracking-wide text-[#8b7cf6]">
            <Sparkles size={11} />
            AI
            {turn.usedContext && (
              <span className="flex items-center gap-0.5 rounded-full border border-[color:var(--mer-stroke-hairline)] px-1.5 py-0.5 text-mer-ink-tertiary normal-case">
                <Database size={9} />
                context
              </span>
            )}
          </span>
          {!isStreamingThisTurn && !turn.error && (
            <div className="flex items-center gap-2">
              {relativeTime && <span className="num text-micro text-mer-ink-tertiary">{relativeTime}</span>}
              <CopyButton text={turn.content} />
            </div>
          )}
        </div>
        {turn.error ? (
          <p className="mt-1 text-small text-mer-ink-tertiary">
            {turn.error}
            {countdown > 0 && <span className="num"> Try again in {countdown}s.</span>}
          </p>
        ) : turn.content === "" ? (
          <span className="mt-1 inline-block h-3 w-1.5 animate-pulse bg-[#8b7cf6]" />
        ) : (
          <AiMarkdown text={turn.content} className="mt-1" />
        )}
      </div>
    </div>
  );
}

/** AI Chat (C1) -- streamed, scope-parameterized ("portfolio" | "market"),
 * AI-card visual grammar per DESIGN_SPEC A6/A7 rather than consumer
 * bubble-chat: assistant turns get the iris ✦ marker, user turns are a
 * plain neutral container, no color-coded chat bubbles either way. */
export function AiChatPanel({ onMessageSent, heightClassName }: { onMessageSent?: () => void; heightClassName?: string } = {}) {
  const [scope, setScope] = React.useState<AiChatScope>("portfolio");
  const [useContext, setUseContext] = React.useState(false);
  const [turns, setTurns] = React.useState<ChatTurn[]>([]);
  const [input, setInput] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const userTurn: ChatTurn = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const assistantId = crypto.randomUUID();
    const history: AiChatMessage[] = [
      ...turns.filter((t) => !t.error).map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: trimmed },
    ];

    setTurns((prev) => [...prev, userTurn, { id: assistantId, role: "assistant", content: "", usedContext: useContext }]);
    setInput("");
    setIsStreaming(true);
    onMessageSent?.();

    try {
      for await (const chunk of streamAiChat(history, scope, useContext)) {
        setTurns((prev) =>
          prev.map((t) => (t.id === assistantId ? { ...t, content: t.content + chunk } : t))
        );
      }
      setTurns((prev) => prev.map((t) => (t.id === assistantId ? { ...t, completedAt: Date.now() } : t)));
    } catch (err) {
      const notConfigured = err instanceof AiChatStreamError && err.status === 503;
      const rateLimited = err instanceof AiChatStreamError && err.status === 429;
      setTurns((prev) =>
        prev.map((t) =>
          t.id === assistantId
            ? {
                ...t,
                error: notConfigured
                  ? "AI advisor isn't configured yet."
                  : rateLimited
                    ? "Too many requests."
                    : "Couldn't generate a response. Retry.",
                retryAfterSeconds: err instanceof AiChatStreamError ? err.retryAfterSeconds : null,
              }
            : t
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-mer-md border bg-mer-surface-2",
        heightClassName ?? "h-[600px]"
      )}
      style={{ borderColor: "var(--mer-stroke-hairline)" }}
    >
      <div className={cn("flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5", MER_HAIRLINE)}>
        <div className="flex items-center gap-1 rounded-mer-sm border border-[color:var(--mer-stroke-hairline)] p-0.5">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setScope(s.value)}
              className={cn(
                "rounded-mer-sm px-2.5 py-1 text-micro font-medium uppercase tracking-wide transition-colors",
                scope === s.value ? "bg-mer-surface-3 text-mer-ink-primary" : "text-mer-ink-tertiary hover:text-mer-ink-secondary"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-micro text-mer-ink-tertiary">
          <input
            type="checkbox"
            checked={useContext}
            onChange={(e) => setUseContext(e.target.checked)}
            className="size-3.5 accent-[#8b7cf6]"
          />
          Use my {scope === "portfolio" ? "portfolio" : "market"} data as context
        </label>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Sparkles size={22} className="text-[#8b7cf6]" />
            <p className="text-small text-mer-ink-tertiary">Ask about your portfolio or the market. Nothing here is real financial advice.</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTED_PROMPTS[scope].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  className="rounded-full border border-[color:var(--mer-stroke-hairline)] px-2.5 py-1 text-micro text-mer-ink-secondary hover:border-[#8b7cf6] hover:text-[#8b7cf6]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {turns.map((turn) => (
              <ChatBubble key={turn.id} turn={turn} />
            ))}
          </div>
        )}
      </div>

      <div className={cn("flex items-end gap-2 border-t p-2.5", MER_HAIRLINE)}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder="Ask a question..."
          rows={1}
          className="max-h-24 min-h-[32px] flex-1 resize-none rounded-mer-sm border border-[color:var(--mer-stroke-hairline)] bg-mer-surface-1 px-2.5 py-1.5 text-body text-mer-ink-primary placeholder:text-mer-ink-tertiary focus:border-[#8b7cf6] focus:outline-none disabled:opacity-60"
        />
        <Button size="icon" disabled={isStreaming || !input.trim()} onClick={() => send(input)} aria-label="Send">
          <Send size={14} />
        </Button>
      </div>
    </div>
  );
}
