"use client";

import { BarChart3 } from "lucide-react";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { marketOverviewStats } from "@/lib/dashboard/marketAggregates";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { KpiCounter } from "@/components/dashboard/primitives/KpiCounter";

export function MarketOverviewSection() {
  const { data, isLoading, isError, refetch } = useMarketGrid();
  const stats = marketOverviewStats(data?.companies ?? []);

  return (
    <DashboardPanel eyebrow="Screener" title="Market Overview" icon={BarChart3} live className="col-span-full lg:col-span-6">
      {isError ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-small text-mer-ink-secondary">Couldn&apos;t load market data.</p>
          <button onClick={() => refetch()} className="text-small text-mer-accent-300 hover:underline">
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-4 gap-y-4">
          <KpiCounter label="Companies" value={stats.companyCount} loading={isLoading} />
          <KpiCounter label="Gainers" value={stats.gainerCount} loading={isLoading} />
          <KpiCounter label="Losers" value={stats.loserCount} loading={isLoading} />
          <KpiCounter label="Breadth" value={stats.breadthPct} format="pct" loading={isLoading} />
          <KpiCounter label="Avg Change" value={stats.avgChangePct} format="pct" tone="auto" loading={isLoading} />
          <KpiCounter label="Total Mkt Cap" value={stats.totalMarketCap} format="large" loading={isLoading} />
        </div>
      )}
    </DashboardPanel>
  );
}
