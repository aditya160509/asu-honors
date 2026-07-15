"use client";

import * as React from "react";
import { cn, formatPrice, formatPct } from "@/lib/utils";
import type { EnrichedCompany } from "@/lib/market/types";

export interface TopMoversBarProps {
  companies: EnrichedCompany[];
  onActivateRow: (ticker: string) => void;
}

interface TickerChip {
  ticker: string;
  price: number;
  metricValue: string;
  metricLabel: string;
}

function buildMostVolatile(companies: EnrichedCompany[]): TickerChip[] {
  return companies
    .filter((c) => c.volatility != null && !Number.isNaN(Number(c.volatility)))
    .sort((a, b) => Number(b.volatility) - Number(a.volatility))
    .slice(0, 6)
    .map((c) => ({
      ticker: c.ticker,
      price: Number(c.current_price),
      metricValue: Number(c.volatility).toFixed(2),
      metricLabel: "Vol",
    }));
}

function buildBiggestIvGap(companies: EnrichedCompany[]): TickerChip[] {
  return companies
    .filter((c) => c.ivGapPct != null)
    .sort((a, b) => Math.abs(Number(b.ivGapPct)) - Math.abs(Number(a.ivGapPct)))
    .slice(0, 6)
    .map((c) => ({
      ticker: c.ticker,
      price: Number(c.current_price),
      metricValue: formatPct(c.ivGapPct),
      metricLabel: "IV Gap",
    }));
}

function buildLargestCap(companies: EnrichedCompany[]): TickerChip[] {
  return companies
    .filter((c) => c.market_cap != null && !Number.isNaN(Number(c.market_cap)))
    .sort((a, b) => Number(b.market_cap) - Number(a.market_cap))
    .slice(0, 6)
    .map((c) => ({
      ticker: c.ticker,
      price: Number(c.current_price),
      metricValue: formatLargeNumber(Number(c.market_cap)),
      metricLabel: "Mkt Cap",
    }));
}

function formatLargeNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function Chip({ chip, onClick }: { chip: TickerChip; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex shrink-0 items-center gap-1.5 rounded border px-2 py-1",
        "border-border/40 bg-bg-primary transition-colors",
        "hover:border-accent/40 hover:bg-bg-hover cursor-pointer"
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-text-primary">
        {chip.ticker}
      </span>
      <span className="text-[10px] text-text-secondary">{formatPrice(chip.price)}</span>
      <span className="rounded bg-bg-tertiary px-1 py-0.5 text-[9px] font-medium text-text-secondary">
        {chip.metricValue}
      </span>
    </button>
  );
}

function Section({
  label,
  chips,
  onActivateRow,
}: {
  label: string;
  chips: TickerChip[];
  onActivateRow: (ticker: string) => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary pr-1">
        {label}
      </span>
      <div className="flex items-center gap-1 overflow-hidden">
        {chips.map((c) => (
          <Chip key={c.ticker} chip={c} onClick={() => onActivateRow(c.ticker)} />
        ))}
      </div>
    </div>
  );
}

export function TopMoversBar({ companies, onActivateRow }: TopMoversBarProps) {
  const volatile = React.useMemo(() => buildMostVolatile(companies), [companies]);
  const ivGap = React.useMemo(() => buildBiggestIvGap(companies), [companies]);
  const largeCap = React.useMemo(() => buildLargestCap(companies), [companies]);

  return (
    <div className="flex items-center gap-3 overflow-x-auto rounded-md border border-border bg-bg-secondary px-3 py-2 scrollbar-none">
      <Section label="Most Volatile" chips={volatile} onActivateRow={onActivateRow} />
      <div className="mx-0.5 h-4 w-px shrink-0 bg-border/40" />
      <Section label="Biggest IV Gap" chips={ivGap} onActivateRow={onActivateRow} />
      <div className="mx-0.5 h-4 w-px shrink-0 bg-border/40" />
      <Section label="Largest Cap" chips={largeCap} onActivateRow={onActivateRow} />
    </div>
  );
}
