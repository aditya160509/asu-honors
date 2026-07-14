"use client";

import { ListOrdered } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { groupBySector } from "@/lib/dashboard/marketAggregates";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { DeltaBadge } from "@/components/dashboard/primitives/DeltaBadge";
import { DeltaBar } from "@/components/dashboard/primitives/DeltaBar";

/** Ranked by today's average move — distinct from the Heatmap's cap-weighted view. */
export function SectorPerformanceSection() {
  const { data, isLoading } = useMarketGrid();
  const sectors = [...groupBySector(data?.companies ?? [])].sort((a, b) => b.avgChangePct - a.avgChangePct).slice(0, 8);

  return (
    <DashboardPanel eyebrow="Ranked" title="Sector Performance" icon={ListOrdered} className="col-span-full lg:col-span-4" noBodyPadding>
      <div className="flex flex-col gap-1 p-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} width="100%" height={28} />)
        ) : sectors.length === 0 ? (
          <EmptyState title="No sector data yet." />
        ) : (
          sectors.map((s) => (
            <div key={s.industry} className="flex items-center justify-between gap-3 rounded-mer-sm px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-small text-mer-ink-secondary">{s.industry}</span>
              <DeltaBar value={s.avgChangePct} cap={3} />
              <DeltaBadge value={s.avgChangePct} />
            </div>
          ))
        )}
      </div>
    </DashboardPanel>
  );
}
