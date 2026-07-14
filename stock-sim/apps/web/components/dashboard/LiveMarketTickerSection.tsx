"use client";

import { Radio } from "lucide-react";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { cn, formatPct, formatPrice } from "@/lib/utils";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";

/**
 * Same seamless doubled-track technique as components/marketing/PriceTickerTape
 * (reuses the existing `ticker` CSS keyframe from globals.css), restyled for the
 * TERMINAL surface — the marketing component's mkt-* tokens don't apply here.
 */
export function LiveMarketTickerSection() {
  const { data } = useMarketGrid();
  const companies = data?.companies ?? [];
  const movers = [...companies]
    .filter((c) => c.day_change_pct != null)
    .sort((a, b) => Math.abs(Number(b.day_change_pct)) - Math.abs(Number(a.day_change_pct)))
    .slice(0, 24);

  if (movers.length === 0) return null;
  const track = [...movers, ...movers];

  return (
    <DashboardPanel eyebrow="Live" title="Market Ticker" icon={Radio} live className="col-span-full" noBodyPadding>
      <div className="group h-10 overflow-hidden">
        <div className="flex h-full w-max items-center gap-8 whitespace-nowrap animate-[ticker_45s_linear_infinite] group-hover:[animation-play-state:paused]">
          {track.map((c, i) => (
            <span key={`${c.ticker}-${i}`} className="num flex items-center gap-2 px-2 text-small">
              <span className="font-bold text-mer-ink-secondary">{c.ticker}</span>
              <span className="text-mer-ink-primary">{formatPrice(c.current_price)}</span>
              <span className={cn(Number(c.day_change_pct) >= 0 ? "text-positive" : "text-negative")}>
                {formatPct(c.day_change_pct)}
              </span>
            </span>
          ))}
        </div>
      </div>
    </DashboardPanel>
  );
}
