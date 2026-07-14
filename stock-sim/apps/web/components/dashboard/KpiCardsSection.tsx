"use client";

import { Gauge, PieChart, Sparkles, Target, Wallet2 } from "lucide-react";
import { usePortfolio, usePortfolioAnalytics } from "@/lib/api/hooks/usePortfolio";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { KpiCounter } from "@/components/dashboard/primitives/KpiCounter";

/** DESIGN_SPEC "metric card" pattern, five of them in a row — every headline number a live GSAP counter. */
export function KpiCardsSection() {
  const portfolio = usePortfolio();
  const analytics = usePortfolioAnalytics();
  const loading = portfolio.isLoading || analytics.isLoading;

  return (
    <DashboardPanel
      eyebrow="Performance"
      title="Key Metrics"
      icon={Gauge}
      className="col-span-full lg:col-span-4"
      bodyClassName="grid grid-cols-2 gap-x-4 gap-y-5"
    >
      <KpiCounter
        label="Total Return"
        value={analytics.data?.total_return_pct ?? 0}
        format="pct"
        tone="auto"
        icon={Target}
        loading={loading}
      />
      <KpiCounter
        label="Unrealized P&L"
        value={analytics.data ? Number(analytics.data.unrealized_pnl) : 0}
        format="price"
        tone="auto"
        icon={Sparkles}
        loading={loading}
      />
      <KpiCounter
        label="Realized P&L"
        value={analytics.data ? Number(analytics.data.realized_pnl) : 0}
        format="price"
        tone="auto"
        icon={Wallet2}
        loading={loading}
      />
      <KpiCounter
        label="Cash Allocation"
        value={analytics.data?.cash_allocation_pct ?? 0}
        format="pct"
        icon={PieChart}
        loading={loading}
      />
      {analytics.data?.win_rate != null && (
        <KpiCounter label="Win Rate" value={analytics.data.win_rate * 100} format="pct" loading={loading} />
      )}
      <KpiCounter label="Positions" value={portfolio.data?.holdings.length ?? 0} format="number" loading={loading} />
    </DashboardPanel>
  );
}
