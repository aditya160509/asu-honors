"use client";

import { cn, formatPct, formatPrice } from "@/lib/utils";
import type { EnrichedCompany } from "@/lib/market/types";

export interface MarketTickerTapeProps {
  companies: EnrichedCompany[];
  onActivateRow: (ticker: string) => void;
}

/** Seamless auto-scrolling ticker strip, terminal-styled — same doubled-track
 * CSS-loop technique as the marketing site's PriceTickerTape, restyled with
 * `--term-*` tokens/mono font to match the Bloomberg-terminal screener. */
export function MarketTickerTape({ companies, onActivateRow }: MarketTickerTapeProps) {
  const movers = companies
    .filter((c) => c.day_change_pct != null)
    .sort((a, b) => Math.abs(Number(b.day_change_pct)) - Math.abs(Number(a.day_change_pct)))
    .slice(0, 30);

  if (movers.length === 0) return null;

  const track = [...movers, ...movers];

  return (
    <div className="group h-7 shrink-0 overflow-hidden border-b border-[var(--term-hairline)] bg-[var(--term-bg)]">
      <div className="flex h-7 w-max animate-[ticker_45s_linear_infinite] items-center gap-4 whitespace-nowrap group-hover:[animation-play-state:paused]">
        {track.map((c, i) => {
          const up = Number(c.day_change_pct) >= 0;
          return (
            <button
              key={`${c.ticker}-${i}`}
              type="button"
              onClick={() => onActivateRow(c.ticker)}
              className="flex shrink-0 items-center gap-1.5 px-1 font-mono text-[11px] tabular-nums hover:opacity-80"
            >
              <span className="font-semibold text-[var(--term-amber)]">{c.ticker}</span>
              <span className="text-[var(--term-ink-secondary)]">{formatPrice(Number(c.current_price))}</span>
              <span className={cn(up ? "text-[var(--term-up)]" : "text-[var(--term-down)]")}>
                {up ? "▲" : "▼"} {formatPct(c.day_change_pct)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
