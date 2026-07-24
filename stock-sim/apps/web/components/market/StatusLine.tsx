"use client";

import * as React from "react";
import { cn, formatLarge, formatPct } from "@/lib/utils";
import type { ParsedToken } from "@/lib/market/commandGrammar";
import type { EnrichedCompany } from "@/lib/market/types";

export interface StatusLineProps {
  tokens: ParsedToken[];
  onRemoveToken: (raw: string) => void;
  screenName: string;
  screenModified: boolean;
  companies: EnrichedCompany[];
  stale?: boolean;
  staleSince?: string | null;
  /** Overrides the default "DELAYED" label (e.g. "HISTORICAL" for a
   * deliberate time-machine view rather than an actual data-freshness lag). */
  staleLabel?: string;
  compareCount?: number;
  onOpenCompare?: () => void;
}

function useTicker() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function StatusLine({
  tokens,
  onRemoveToken,
  screenName,
  screenModified,
  companies,
  stale = false,
  staleSince = null,
  staleLabel = "DELAYED",
  compareCount = 0,
  onOpenCompare,
}: StatusLineProps) {
  const now = useTicker();
  const clock = now.toTimeString().slice(0, 8);

  const avgChg = React.useMemo(() => {
    const valid = companies.filter((c) => c.day_change_pct != null);
    if (valid.length === 0) return null;
    return valid.reduce((acc, c) => acc + Number(c.day_change_pct), 0) / valid.length;
  }, [companies]);

  const totalCap = React.useMemo(
    () => companies.reduce((acc, c) => acc + (Number(c.market_cap) || 0), 0),
    [companies]
  );

  return (
    <div className="flex h-[26px] items-center gap-3 border-b border-[var(--term-hairline)] bg-[var(--term-bg)] px-4 font-mono text-[11px] uppercase tracking-[0.04em]">
      <span className="flex items-center gap-1.5 truncate">
        <span className="text-[var(--term-amber)]">Filters</span>
        {tokens.length === 0 ? (
          <span className="text-[var(--term-ink-tertiary)] normal-case">—</span>
        ) : (
          tokens.map((t, i) => (
            <button
              key={`${t.raw}-${i}`}
              type="button"
              onClick={() => onRemoveToken(t.raw)}
              title={`Remove ${t.raw}`}
              className={cn(
                "normal-case lowercase hover:line-through",
                t.valid ? "text-[var(--term-ink)]" : "text-[var(--term-down)]"
              )}
            >
              {t.label}
            </button>
          ))
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        <span className="text-[var(--term-amber)]">Screen</span>
        <span className="text-[var(--term-ink)] normal-case">
          {screenName}
          {screenModified ? "•" : ""}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        <span className="text-[var(--term-amber)]">Avg Chg</span>
        <span
          className={cn("tabular-nums", avgChg != null && (avgChg >= 0 ? "text-[var(--term-up)]" : "text-[var(--term-down)]"))}
        >
          {avgChg != null ? formatPct(avgChg) : "—"}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        <span className="text-[var(--term-amber)]">Tot Cap</span>
        <span className="tabular-nums text-[var(--term-ink)]">{formatLarge(totalCap)}</span>
      </span>

      {compareCount > 0 && (
        <button type="button" onClick={onOpenCompare} className="shrink-0 text-[var(--term-accent)] hover:underline">
          Compare ({compareCount})
        </button>
      )}

      <div className="flex-1" />

      {stale ? (
        <span className="shrink-0 text-[var(--term-amber)]">{staleLabel} {staleSince ?? "—"}</span>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--term-up)] motion-safe:animate-pulse" />
          <span className="text-[var(--term-up)]">LIVE</span>
          <span className="text-[var(--term-ink-tertiary)]">·SIM</span>
          <span className="tabular-nums text-[var(--term-ink-secondary)]">{clock}</span>
        </span>
      )}
    </div>
  );
}
