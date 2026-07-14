"use client";

import { Flame } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { trendingCompanies } from "@/lib/dashboard/marketAggregates";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { CompanyRow } from "@/components/dashboard/primitives/CompanyRow";

/** "Trending" = largest combined |day change| + volatility — a real derived heuristic (no view/trend feed exists). */
export function TrendingCompaniesSection() {
  const { data, isLoading } = useMarketGrid();
  const rows = trendingCompanies(data?.companies ?? [], 6);

  return (
    <DashboardPanel eyebrow="Momentum" title="Trending Companies" icon={Flame} className="col-span-full md:col-span-6 lg:col-span-4" noBodyPadding>
      <div className="flex flex-col gap-0.5 p-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} width="100%" height={40} />)
        ) : rows.length === 0 ? (
          <EmptyState title="No market data yet." />
        ) : (
          rows.map((c) => (
            <CompanyRow
              key={c.ticker}
              ticker={c.ticker}
              name={c.name}
              price={Number(c.current_price)}
              changePct={c.day_change_pct != null ? Number(c.day_change_pct) : null}
            />
          ))
        )}
      </div>
    </DashboardPanel>
  );
}
