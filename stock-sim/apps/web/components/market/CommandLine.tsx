"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CAP_ALIASES, parseCommandLine, type ParsedToken } from "@/lib/market/commandGrammar";

export interface CommandLineProps {
  value: string;
  onChange: (next: string) => void;
  onCommand: (name: string, args: string) => void;
  industries: string[];
  resultCount: number;
  totalCount: number;
  viewMode: "table" | "heatmap";
  onViewModeChange: (mode: "table" | "heatmap") => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

/** Splits the raw text into renderable segments — one per whitespace-run and
 * per token — so the overlay div can color amber (key) vs ink (value) vs
 * negative (invalid token) while a transparent real <input> sits on top for
 * actual typing/caret/selection. */
function renderHighlighted(text: string, tokens: ParsedToken[]) {
  if (text.length === 0) return null;
  const byRaw = new Map(tokens.map((t) => [t.raw, t]));
  const words = text.split(/(\s+)/); // keep whitespace runs as their own entries
  return words.map((w, i) => {
    if (/^\s+$/.test(w) || w === "") return <span key={i}>{w}</span>;
    if (w.startsWith(">")) {
      return (
        <span key={i} className="text-[var(--term-amber)]">
          {w}
        </span>
      );
    }
    const token = byRaw.get(w);
    if (!token) {
      return (
        <span key={i} className="text-[var(--term-ink)]">
          {w}
        </span>
      );
    }
    if (!token.valid) {
      return (
        <span key={i} className="text-[var(--term-down)] underline decoration-dotted">
          {w}
        </span>
      );
    }
    const splitAt = w.search(/[:<>]/);
    const key = splitAt >= 0 ? w.slice(0, splitAt + 1) : w;
    const rest = splitAt >= 0 ? w.slice(splitAt + 1) : "";
    return (
      <span key={i}>
        <span className="text-[var(--term-amber)]">{key}</span>
        <span className="text-[var(--term-ink)]">{rest}</span>
      </span>
    );
  });
}

export function CommandLine({
  value,
  onChange,
  onCommand,
  industries,
  resultCount,
  totalCount,
  viewMode,
  onViewModeChange,
  inputRef,
}: CommandLineProps) {
  const [focused, setFocused] = React.useState(false);
  const parsed = React.useMemo(() => parseCommandLine(value, industries), [value, industries]);

  // Autocomplete for the token currently being typed (the last whitespace-
  // delimited word), only for cap:/sector: — the two enumerable vocabularies.
  const lastWord = value.slice(value.lastIndexOf(" ") + 1);
  const capPrefix = lastWord.match(/^cap:(.*)$/i);
  const sectorPrefix = lastWord.match(/^sector:(.*)$/i);
  const suggestions: string[] = React.useMemo(() => {
    if (capPrefix) {
      const q = capPrefix[1].toLowerCase();
      return CAP_ALIASES.filter((c) => c.startsWith(q) && c !== q).map((c) => `cap:${c}`);
    }
    if (sectorPrefix) {
      const q = sectorPrefix[1].toLowerCase();
      return industries.filter((i) => i.toLowerCase().includes(q) && i.toLowerCase() !== q).slice(0, 8).map((i) => `sector:${i}`);
    }
    return [];
  }, [capPrefix, sectorPrefix, industries]);

  function acceptSuggestion(s: string) {
    const beforeLast = value.slice(0, value.lastIndexOf(" ") + 1);
    onChange(`${beforeLast}${s} `);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const trimmed = value.trim();
      if (trimmed.startsWith(">")) {
        const rest = trimmed.slice(1).trim();
        const spaceIdx = rest.indexOf(" ");
        const name = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).toLowerCase();
        const args = spaceIdx === -1 ? "" : rest.slice(spaceIdx + 1).trim();
        if (name) {
          e.preventDefault();
          // onCommand decides what the command line shows afterward (e.g.
          // >load replaces it with the loaded screen's tokens; most other
          // commands restore whatever filters were active before the `>`
          // was typed) — it must not be blindly cleared here, which would
          // stomp on that decision.
          onCommand(name, args);
        }
      } else if (suggestions.length > 0) {
        e.preventDefault();
        acceptSuggestion(suggestions[0]);
      }
    } else if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      acceptSuggestion(suggestions[0]);
    } else if (e.key === "Escape") {
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <div className="relative flex h-9 items-center gap-3 border-b border-[var(--term-divider)] bg-[var(--term-bg)] px-4">
      <span className="shrink-0 font-mono text-[13px] font-semibold text-[var(--term-amber)]">SCRN&gt;</span>

      <div className="relative min-w-0 flex-1">
        <div
          aria-hidden
          className="pointer-events-none select-none whitespace-pre font-mono text-[13px] leading-[20px]"
        >
          {renderHighlighted(value, parsed.tokens) ?? (
            <span className="text-[var(--term-ink-tertiary)]">
              cap:mega sector:it chg&gt;+5 — or &gt;help
            </span>
          )}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          spellCheck={false}
          autoComplete="off"
          aria-label="Screener command line — search, filter tokens, or >commands"
          className="absolute inset-0 h-full w-full bg-transparent font-mono text-[13px] leading-[20px] text-transparent caret-[var(--term-ink)] outline-none"
        />

        {focused && suggestions.length > 0 && (
          <div className="absolute left-0 top-full z-30 mt-1 w-64 border-t border-[var(--term-divider)] bg-[var(--term-bg)] shadow-[0_8px_24px_rgba(4,6,10,0.5)] shadow-[0_0_0_1px_var(--mer-stroke-emphasis)]">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptSuggestion(s);
                }}
                className="flex w-full items-center px-3 py-1.5 text-left font-mono text-[13px] text-[var(--term-ink-secondary)] hover:bg-white/5 hover:text-[var(--term-ink)]"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="shrink-0 font-mono text-[13px] tabular-nums text-[var(--term-ink-secondary)]">
        {resultCount.toLocaleString()}/{totalCount.toLocaleString()}
      </span>

      <div className="flex shrink-0 items-center gap-2 border-l border-[var(--term-hairline)] pl-3 font-mono text-[13px]">
        <button
          type="button"
          onClick={() => onViewModeChange("table")}
          className={cn(viewMode === "table" ? "text-[var(--term-ink)]" : "text-[var(--term-ink-tertiary)] hover:text-[var(--term-ink-secondary)]")}
        >
          TBL
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("heatmap")}
          className={cn(viewMode === "heatmap" ? "text-[var(--term-ink)]" : "text-[var(--term-ink-tertiary)] hover:text-[var(--term-ink-secondary)]")}
        >
          HMP
        </button>
      </div>

      <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-[var(--term-ink-tertiary)]">⌘K</span>
    </div>
  );
}
