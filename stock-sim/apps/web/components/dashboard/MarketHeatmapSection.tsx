"use client";

import { Grid3x3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { groupBySector } from "@/lib/dashboard/marketAggregates";
import { formatLarge, formatPct } from "@/lib/utils";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";

const HEAT_CAP = 4; // avg day-change % that maps to full-intensity tile color

function heatColor(avgChangePct: number): string {
  const intensity = Math.min(Math.abs(avgChangePct) / HEAT_CAP, 1);
  const opacity = 0.12 + intensity * 0.45;
  return avgChangePct >= 0 ? `rgba(34,197,94,${opacity})` : `rgba(239,68,68,${opacity})`;
}

/** Sector treemap approximation — tile area weighted by market cap share via flex-grow, not a full squarified layout. */
export function MarketHeatmapSection() {
  const { data, isLoading } = useMarketGrid();
  const sectors = groupBySector(data?.companies ?? []);
  const totalCap = sectors.reduce((sum, s) => sum + s.totalMarketCap, 0) || 1;

  return (
    <DashboardPanel eyebrow="Sectors" title="Market Heatmap" icon={Grid3x3} className="col-span-full lg:col-span-8" noBodyPadding>
      {isLoading ? (
        <div className="grid grid-cols-3 gap-1 p-3 sm:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={64} />
          ))}
        </div>
      ) : sectors.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No sector data yet." />
        </div>
      ) : (
        <div className="flex flex-wrap gap-1 p-3">
          {sectors.map((s) => {
            const share = s.totalMarketCap / totalCap;
            return (
              <Tooltip key={s.industry}>
                <TooltipTrigger asChild>
                  <div
                    className="flex min-w-[104px] flex-col justify-between gap-3 rounded-mer-xs p-2.5"
                    style={{ backgroundColor: heatColor(s.avgChangePct), flexGrow: Math.max(share * 100, 4), flexBasis: 104 }}
                  >
                    <span className="truncate text-micro font-medium uppercase text-mer-ink-primary">
                      {s.industry}
                    </span>
                    <span className="num text-small font-semibold text-mer-ink-primary">{formatPct(s.avgChangePct)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {s.industry} · {s.companyCount} companies · {formatLarge(s.totalMarketCap)} cap
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
