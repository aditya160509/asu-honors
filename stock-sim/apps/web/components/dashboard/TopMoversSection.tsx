"use client";

import { ArrowLeftRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { topGainers, topLosers } from "@/lib/dashboard/marketAggregates";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { CompanyRow } from "@/components/dashboard/primitives/CompanyRow";

export function TopMoversSection() {
  const { data, isLoading } = useMarketGrid();
  const gainers = topGainers(data?.companies ?? [], 5);
  const losers = topLosers(data?.companies ?? [], 5);

  return (
    <DashboardPanel
      eyebrow="Volatility"
      title="Top Movers"
      icon={ArrowLeftRight}
      className="col-span-full lg:col-span-8"
      noBodyPadding
    >
      <div className="grid grid-cols-1 divide-y divide-[color:var(--mer-stroke-hairline)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="flex flex-col gap-0.5 p-2">
          <span className="px-2 pb-1 text-micro font-medium uppercase tracking-wide text-positive">Gainers</span>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} width="100%" height={40} />)
          ) : gainers.length === 0 ? (
            <EmptyState title="No gainers yet." />
          ) : (
            gainers.map((c) => (
              <CompanyRow
                key={c.ticker}
                ticker={c.ticker}
                name={c.name}
                price={Number(c.current_price)}
                changePct={Number(c.day_change_pct)}
              />
            ))
          )}
        </div>
        <div className="flex flex-col gap-0.5 p-2">
          <span className="px-2 pb-1 text-micro font-medium uppercase tracking-wide text-negative">Losers</span>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} width="100%" height={40} />)
          ) : losers.length === 0 ? (
            <EmptyState title="No losers yet." />
          ) : (
            losers.map((c) => (
              <CompanyRow
                key={c.ticker}
                ticker={c.ticker}
                name={c.name}
                price={Number(c.current_price)}
                changePct={Number(c.day_change_pct)}
              />
            ))
          )}
        </div>
      </div>
    </DashboardPanel>
  );
}
