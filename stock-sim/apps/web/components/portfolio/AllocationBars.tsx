"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { formatLarge, formatPct } from "@/lib/utils";
import { allocationColor } from "@/lib/portfolio/allocationPalette";
import type { SectorAllocation } from "@/lib/api/types";

export interface AllocationBarsProps {
  allocation: SectorAllocation[];
}

export function AllocationBars({ allocation }: AllocationBarsProps) {
  if (allocation.length === 0) return <EmptyState title="No allocation data yet." />;
  const sorted = [...allocation].sort((a, b) => b.pct - a.pct);
  const maxPct = Math.max(...sorted.map((s) => s.pct), 1);

  return (
    <div className="flex flex-col gap-3 p-4">
      {sorted.map((s, i) => (
        <div key={s.sector} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-small">
            <span className="text-mer-ink-secondary">{s.sector}</span>
            <span className="num text-mer-ink-primary">
              {formatPct(s.pct)} · {formatLarge(s.value)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-mer-surface-4">
            <div
              className="h-full rounded-full"
              style={{ width: `${(s.pct / maxPct) * 100}%`, backgroundColor: allocationColor(i) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
