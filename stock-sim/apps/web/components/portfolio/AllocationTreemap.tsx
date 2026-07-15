"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { formatLarge, formatPct } from "@/lib/utils";
import { allocationColor } from "@/lib/portfolio/allocationPalette";
import type { SectorAllocation } from "@/lib/api/types";

export interface AllocationTreemapProps {
  allocation: SectorAllocation[];
}

/** Tile area weighted by allocation share via flex-grow — the same treemap-approximation technique
 * as the Dashboard's MarketHeatmapSection, applied to sector allocation instead of price heat (so
 * color encodes category, not directional magnitude). */
export function AllocationTreemap({ allocation }: AllocationTreemapProps) {
  if (allocation.length === 0) return <EmptyState title="No allocation data yet." />;
  const sorted = [...allocation].sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-wrap gap-1 p-3">
      {sorted.map((s, i) => (
        <Tooltip key={s.sector}>
          <TooltipTrigger asChild>
            <div
              className="flex min-w-[104px] flex-col justify-between gap-3 rounded-mer-xs p-2.5"
              style={{ backgroundColor: allocationColor(i), flexGrow: Math.max(s.pct, 4), flexBasis: 104 }}
            >
              <span className="truncate text-micro font-medium uppercase text-white/90">{s.sector}</span>
              <span className="num text-small font-semibold text-white">{formatPct(s.pct)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {s.sector} · {formatLarge(s.value)} · {formatPct(s.pct)} of holdings
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
