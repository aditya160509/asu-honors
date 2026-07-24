"use client";

import { PieChart, Target, Wallet } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { KpiCounter } from "@/components/dashboard/primitives/KpiCounter";
import { usePortfolio, usePortfolioAnalytics } from "@/lib/api/hooks/usePortfolio";

/** Live, raw numbers sitting next to the AI narrative -- same KpiCounter
 * primitive as the Dashboard's Key Metrics panel, so a user can sanity
 * check the AI's claims against the real values at a glance instead of
 * taking the generated text on faith. */
export function PortfolioQuickStatsPanel({ className }: { className?: string }) {
  const portfolio = usePortfolio();
  const analytics = usePortfolioAnalytics();
  const loading = portfolio.isLoading || analytics.isLoading;

  const statCardClass =
    "rounded-mer-sm border border-transparent bg-mer-surface-1 p-3 transition-all duration-fast ease-out-expo hover:border-[color:var(--mer-stroke-hairline)] hover:bg-mer-surface-2 active:scale-[0.98]";

  return (
    <DashboardPanel eyebrow="Live Snapshot" title="Your Portfolio" icon={Wallet} className={className} bodyClassName="grid grid-cols-2 gap-3">
      <div className={statCardClass}>
        <KpiCounter
          label="Total Value"
          value={analytics.data ? Number(analytics.data.total_value) : 0}
          format="price"
          size="lg"
          loading={loading}
        />
      </div>
      <div className={statCardClass}>
        <KpiCounter
          label="Total Return"
          value={analytics.data?.total_return_pct ?? 0}
          format="pct"
          tone="auto"
          icon={Target}
          loading={loading}
        />
      </div>
      <div className={statCardClass}>
        <KpiCounter label="Positions" value={portfolio.data?.holdings.length ?? 0} format="number" loading={loading} />
      </div>
      <div className={statCardClass}>
        <KpiCounter
          label="Cash Allocation"
          value={analytics.data?.cash_allocation_pct ?? 0}
          format="pct"
          icon={PieChart}
          loading={loading}
        />
      </div>
    </DashboardPanel>
  );
}
