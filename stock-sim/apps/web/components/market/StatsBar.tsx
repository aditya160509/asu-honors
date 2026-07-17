"use client";

import * as React from "react";
import { cn, formatLarge, formatPct, formatPrice } from "@/lib/utils";
import type { EnrichedCompany } from "@/lib/market/types";

export interface StatsBarProps {
  companies: EnrichedCompany[];
}

function Stat({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-micro text-text-tertiary uppercase tracking-wider">{label}</span>
      <span className={cn("text-micro font-medium tabular-nums", className)}>{children}</span>
    </div>
  );
}

export function StatsBar({ companies }: StatsBarProps) {
  const count = companies.length;

  const avgPrice = React.useMemo(() => {
    if (count === 0) return null;
    const sum = companies.reduce((acc, c) => acc + Number(c.current_price), 0);
    return sum / count;
  }, [companies, count]);

  const totalMarketCap = React.useMemo(() => {
    return companies.reduce((acc, c) => acc + (Number(c.market_cap) || 0), 0);
  }, [companies]);

  const avgDayChange = React.useMemo(() => {
    const valid = companies.filter((c) => c.day_change_pct != null);
    if (valid.length === 0) return null;
    const sum = valid.reduce((acc, c) => acc + Number(c.day_change_pct), 0);
    return sum / valid.length;
  }, [companies]);

  const avgIvGap = React.useMemo(() => {
    const valid = companies.filter((c) => c.ivGapPct != null);
    if (valid.length === 0) return null;
    const sum = valid.reduce((acc, c) => acc + (c.ivGapPct ?? 0), 0);
    return sum / valid.length;
  }, [companies]);

  return (
    <div className="flex items-center gap-3 border-b border-border/60 bg-bg-secondary px-3 py-1.5">
      <Stat label="Companies">{count.toLocaleString()}</Stat>
      <Divider />
      <Stat label="Avg Price">{avgPrice != null ? formatPrice(avgPrice) : "—"}</Stat>
      <Divider />
      <Stat label="Total Cap">{formatLarge(totalMarketCap)}</Stat>
      <Divider />
      <Stat
        label="Avg Chg"
        className={cn(
          avgDayChange != null && (avgDayChange >= 0 ? "text-positive" : "text-negative")
        )}
      >
        {avgDayChange != null ? formatPct(avgDayChange) : "—"}
      </Stat>
      <Divider />
      {/* IV Gap is a valuation distance, not a direction — unlike Day Chg, its
          sign isn't "good/bad" the way price direction is, so it stays
          neutral ink rather than reusing the market red/green pair. */}
      <Stat label="Avg IV Gap">{avgIvGap != null ? formatPct(avgIvGap) : "—"}</Stat>
    </div>
  );
}

function Divider() {
  return <div className="h-3 w-px bg-border/60" />;
}
