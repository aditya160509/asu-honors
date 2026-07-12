import { formatPct, formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { CompanyGridItem } from "@/lib/api/types";

export interface PriceTickerTapeProps {
  companies: CompanyGridItem[];
}

/** Seamless auto-scrolling ticker strip — CSS transform loop over a doubled content block. */
export function PriceTickerTape({ companies }: PriceTickerTapeProps) {
  const movers = [...companies]
    .filter((c) => c.day_change_pct != null)
    .sort((a, b) => Math.abs(b.day_change_pct ?? 0) - Math.abs(a.day_change_pct ?? 0))
    .slice(0, 20);

  if (movers.length === 0) return null;

  const track = [...movers, ...movers];

  return (
    <div className="h-9 border-b border-white/10 bg-mkt-bg-elevated overflow-hidden group">
      <div className="flex items-center gap-8 whitespace-nowrap animate-[ticker_40s_linear_infinite] group-hover:[animation-play-state:paused] w-max">
        {track.map((c, i) => (
          <span key={`${c.ticker}-${i}`} className="num text-small flex items-center gap-2 px-2">
            <span className="text-mkt-text-muted font-semibold">{c.ticker}</span>
            <span className="text-mkt-text-hero">{formatPrice(Number(c.current_price))}</span>
            <span className={cn(c.day_change_pct! >= 0 ? "text-positive" : "text-negative")}>
              {formatPct(c.day_change_pct)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
