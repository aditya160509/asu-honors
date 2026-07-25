"use client";

import * as React from "react";
import { AlertTriangle, Sparkle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseSmartQuery, smartQueryMetricLabels } from "@/lib/market/smartQuery";

export interface SmartQueryBarProps {
  value: string;
  onChange: (next: string) => void;
  resultCount: number;
}

const EXAMPLE = "market cap < $500 Mil and volatility > 60 and day change > 5";

/** Free-form "companies with X and Y and Z" query box, independent from the
 * command-line token grammar — natural sentences don't fit that compact
 * syntax, so this gets its own small parser (lib/market/smartQuery.ts) and
 * its own predicate, ANDed into the same filtered set the table renders. */
export function SmartQueryBar({ value, onChange, resultCount }: SmartQueryBarProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setDraft(value), [value]);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const parsed = React.useMemo(() => parseSmartQuery(draft), [draft]);

  function commit(next: string) {
    setDraft(next);
    onChange(next);
  }

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Smart query — describe criteria in plain English"
        aria-pressed={open || value.trim().length > 0}
        className={cn(
          "flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors",
          open || value.trim().length > 0
            ? "border-[var(--term-amber)] text-[var(--term-amber)]"
            : "border-transparent text-[var(--term-ink-secondary)] hover:border-[var(--term-divider)] hover:text-[var(--term-ink)]"
        )}
      >
        <Sparkle size={12} />
        {value.trim() ? "Smart Query •" : "Smart Query"}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-[420px] border border-[var(--term-divider)] bg-[var(--term-bg)] p-3 shadow-[0_8px_24px_rgba(4,6,10,0.5)] shadow-[0_0_0_1px_var(--mer-stroke-emphasis)]">
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--term-ink-tertiary)]">
            Describe criteria — combine any metrics with &quot;and&quot;
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit(draft);
              }
            }}
            placeholder={EXAMPLE}
            rows={2}
            spellCheck={false}
            autoFocus
            className="w-full resize-none border border-[var(--term-divider)] bg-transparent px-2 py-1.5 font-mono text-[12px] text-[var(--term-ink)] outline-none placeholder:text-[var(--term-ink-tertiary)] focus:border-[var(--term-amber)]"
          />

          <div className="mt-2 flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {parsed.clauses.map((clause, i) => (
                <span
                  key={`${clause.raw}-${i}`}
                  className="rounded-sm border border-[var(--term-divider)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--term-ink)]"
                >
                  {clause.metricLabel} {clause.op} {clause.value}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => commit("")}
              className="flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase text-[var(--term-ink-tertiary)] hover:text-[var(--term-ink)]"
            >
              <X size={10} />
              Clear
            </button>
          </div>

          {parsed.errors.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-[var(--term-hairline)] pt-2">
              {parsed.errors.map((err, i) => (
                <div key={`${err.raw}-${i}`} className="flex items-start gap-1.5 font-mono text-[10px] text-[var(--term-down)]">
                  <AlertTriangle size={11} className="mt-[1px] shrink-0" />
                  <span>
                    Couldn&apos;t parse &quot;{err.raw}&quot; — {err.reason}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-[var(--term-hairline)] pt-2 font-mono text-[10px] text-[var(--term-ink-tertiary)]">
            <span>{parsed.clauses.length > 0 ? `${resultCount} match${resultCount === 1 ? "" : "es"}` : "No active criteria"}</span>
            <button
              type="button"
              onClick={() => commit(draft)}
              className="rounded-sm border border-[var(--term-amber)] px-2 py-0.5 text-[var(--term-amber)] hover:bg-[var(--term-amber)] hover:text-[var(--term-bg)]"
            >
              Apply
            </button>
          </div>

          <div className="mt-2 truncate font-mono text-[10px] text-[var(--term-ink-tertiary)]" title={smartQueryMetricLabels().join(", ")}>
            Metrics: {smartQueryMetricLabels().join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}
