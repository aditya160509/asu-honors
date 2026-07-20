"use client";

import { cn } from "@/lib/utils";
import { useCycleState } from "@/lib/api/hooks/useMarket";
import { useNews } from "@/lib/api/hooks/useNews";
import { useSentimentDrivers } from "@/lib/dashboard/useSentimentDrivers";
import type { EnrichedCompany } from "@/lib/market/types";

export interface SentimentStripProps {
  companies: EnrichedCompany[];
}

function toneFor(value: number): string {
  if (value <= 40) return "text-[var(--term-down)]";
  if (value >= 60) return "text-[var(--term-up)]";
  return "text-[var(--term-ink)]";
}

function moodLabel(value: number): string {
  if (value <= 20) return "Extreme Fear";
  if (value <= 40) return "Fear";
  if (value <= 60) return "Neutral";
  if (value <= 80) return "Greed";
  return "Extreme Greed";
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="text-[var(--term-amber)]">{label}</span>
      <span className={cn("tabular-nums", toneFor(value))}>{value.toFixed(0)}</span>
    </span>
  );
}

/** Compact, term-styled sentiment readout for the screener — same composite
 * (lib/market/sentimentScore) as the Dashboard/Simulation gauges, just a
 * single inline row matching StatusLine's own stat-pair convention instead
 * of the canvas gauge (kept text-only to match the terminal's aesthetic). */
export function SentimentStrip({ companies }: SentimentStripProps) {
  const cycle = useCycleState();
  const news = useNews({ limit: 50 });
  const drivers = useSentimentDrivers(companies, cycle.data?.market_sentiment, news.data ?? [], cycle.data?.sim_date);

  return (
    <div className="flex h-7 shrink-0 items-center gap-4 overflow-x-auto border-b border-[var(--term-hairline)] bg-[var(--term-bg)] px-4 font-mono text-[11px] uppercase tracking-[0.04em]">
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="text-[var(--term-amber)]">Sentiment</span>
        <span className={cn("tabular-nums font-semibold", toneFor(drivers.composite))}>
          {drivers.composite.toFixed(0)}
        </span>
        <span className={cn("normal-case", toneFor(drivers.composite))}>{moodLabel(drivers.composite)}</span>
      </span>
      <Stat label="Cycle" value={drivers.cycle} />
      <Stat label="Breadth" value={drivers.breadth} />
      <Stat label="Momentum" value={drivers.momentum} />
      <Stat label="News" value={drivers.news} />
      <Stat label="Volatility" value={drivers.volatility} />
      <Stat label="52w Breadth" value={drivers.highLowBreadth} />
    </div>
  );
}
