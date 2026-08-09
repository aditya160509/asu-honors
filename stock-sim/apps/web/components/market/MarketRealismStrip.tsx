"use client";

import * as React from "react";
import { useMarketNewsBulletins, useMarketOrderBook, useMarketRegime, useMarketSession } from "@/lib/api/hooks/useMarket";
import { cn, formatPrice } from "@/lib/utils";
import type { MarketOrderBookLevel } from "@/lib/api/types";

export interface MarketRealismStripProps {
  ticker?: string | null;
  timelineId?: number;
  simDate?: string | null;
  compact?: boolean;
}

function labelize(value: string | null | undefined): string {
  return (value ?? "—").replaceAll("_", " ");
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "up" | "down" | "accent" }) {
  return (
    <div className="min-w-0 border-r border-[var(--mer-stroke-hairline)] px-3 last:border-r-0">
      <div className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--mer-ink-tertiary)]">{label}</div>
      <div className={cn(
        "mt-1 truncate font-mono text-[12px] tabular-nums",
        tone === "up" ? "text-[var(--positive)]" : tone === "down" ? "text-[var(--negative)]" : tone === "accent" ? "text-[var(--mer-accent-300)]" : "text-[var(--mer-ink-primary)]",
      )}>
        {value}
      </div>
    </div>
  );
}

function DepthColumn({ label, levels, tone }: { label: string; levels: MarketOrderBookLevel[]; tone: "bid" | "ask" }) {
  const maxQuantity = Math.max(...levels.map((level) => Number(level.quantity) || 0), 1);
  return (
    <div className="min-w-0 flex-1">
      <div className={cn(
        "mb-1 text-[9px] font-semibold uppercase tracking-[0.14em]",
        tone === "bid" ? "text-[var(--positive)]" : "text-[var(--negative)]",
      )}>{label}</div>
      <div className="space-y-0.5">
        {levels.slice(0, 3).map((level, index) => (
          <div key={`${level.price}-${index}`} className="relative flex items-center justify-between gap-2 overflow-hidden font-mono text-[10px] tabular-nums text-[var(--mer-ink-secondary)]">
            <span
              aria-hidden
              className={cn("absolute inset-y-0 left-0 opacity-15", tone === "bid" ? "bg-[var(--positive)]" : "bg-[var(--negative)]")}
              style={{ width: `${Math.max(4, (Number(level.quantity) / maxQuantity) * 100)}%` }}
            />
            <span className="relative z-10">{formatPrice(Number(level.price))}</span>
            <span className="relative z-10 text-[var(--mer-ink-tertiary)]">{Number(level.quantity).toLocaleString()}</span>
          </div>
        ))}
        {levels.length === 0 && <div className="font-mono text-[10px] text-[var(--mer-ink-tertiary)]">No depth</div>}
      </div>
    </div>
  );
}

function statusTone(status: string | undefined): "up" | "down" | "accent" | undefined {
  if (status === "halted") return "down";
  if (status === "open") return "up";
  if (status === "scheduled") return "accent";
  return undefined;
}

export function MarketRealismStrip({ ticker, timelineId, simDate, compact = false }: MarketRealismStripProps) {
  const session = useMarketSession(timelineId, simDate);
  const regime = useMarketRegime(timelineId);
  const book = useMarketOrderBook(ticker, timelineId, simDate);
  const bulletins = useMarketNewsBulletins(timelineId, simDate, 1);

  const depth = book.data?.depth;
  const progress = session.data && session.data.total_ticks > 0
    ? Math.min(100, Math.round((session.data.current_tick / session.data.total_ticks) * 100))
    : 0;
  const regimeTone = regime.data?.market_return != null
    ? regime.data.market_return >= 0 ? "up" : "down"
    : undefined;
  const latestBulletin = bulletins.data?.[0];

  return (
    <section
      aria-label="Market realism state"
      className={cn(
        "shrink-0 border-b border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-1)] font-mono",
        compact ? "px-3 py-2" : "px-4 py-2.5",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 pr-1">
          <span aria-hidden className={cn(
            "h-1.5 w-1.5 rounded-full",
            session.data?.status === "halted" ? "bg-[var(--negative)]" : "bg-[var(--positive)] motion-safe:animate-pulse",
          )} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--mer-ink-primary)]">Market realism</span>
        </div>
        <Metric label="Session" value={labelize(session.data?.phase)} tone={statusTone(session.data?.status)} />
        <Metric
          label="Regime"
          value={labelize(regime.data?.regime)}
          tone={regimeTone}
        />
        <Metric
          label="Progress"
          value={session.data ? `${session.data.current_tick}/${session.data.total_ticks} · ${progress}%` : "—"}
          tone="accent"
        />
        {book.data && (
          <Metric label={`${book.data.ticker} spread`} value={`${Number(book.data.spread_bps).toFixed(1)} bps`} />
        )}
        {session.data?.status === "halted" && (
          <Metric label="Guardrail" value={labelize(session.data.halt_reason)} tone="down" />
        )}
        {latestBulletin && (
          <div className="min-w-0 flex-1 truncate border-l border-[var(--mer-stroke-hairline)] pl-3 text-[10px] text-[var(--mer-ink-secondary)]" title={latestBulletin.body}>
            <span className="mr-2 text-[var(--mer-amber,#c9922e)]">NEWS</span>
            {latestBulletin.headline}
          </div>
        )}
      </div>

      {!compact && (
        <div className="mt-2 flex flex-col gap-2 border-t border-[var(--mer-stroke-hairline)] pt-2 md:flex-row md:items-start">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-y-2 sm:grid-cols-4">
            <Metric label="Mid" value={book.data ? formatPrice(Number(book.data.mid_price)) : "—"} />
            <Metric label="Bid / ask" value={book.data ? `${formatPrice(Number(book.data.bid_price))} / ${formatPrice(Number(book.data.ask_price))}` : "—"} />
            <Metric label="Depth" value={book.data ? `${Number(book.data.bid_size).toLocaleString()} / ${Number(book.data.ask_size).toLocaleString()}` : "—"} />
            <Metric label="Impact" value={book.data ? `${Number(book.data.slippage_bps).toFixed(1)} bps` : "—"} />
          </div>
          <div className="flex min-w-[230px] flex-1 gap-4 border-l border-[var(--mer-stroke-hairline)] pl-3">
            <DepthColumn label="Bids" levels={depth?.bids ?? []} tone="bid" />
            <DepthColumn label="Offers" levels={depth?.asks ?? []} tone="ask" />
          </div>
        </div>
      )}
    </section>
  );
}
