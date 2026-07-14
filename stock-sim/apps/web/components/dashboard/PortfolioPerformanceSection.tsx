"use client";

import { LineChart } from "lucide-react";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { useTransactions } from "@/lib/api/hooks/usePortfolio";
import { cumulativeRealizedPnl } from "@/lib/dashboard/portfolioPerformance";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";

/**
 * Reuses the existing PerformanceChart primitive (components/charts) as-is —
 * fed cumulative realized P&L, the only true time-series performance signal
 * this backend exposes (there's no daily NAV snapshot endpoint).
 */
export function PortfolioPerformanceSection() {
  const transactions = useTransactions(undefined, 200);
  const series = cumulativeRealizedPnl(transactions.data ?? []);

  return (
    <DashboardPanel
      eyebrow="Portfolio Performance"
      title="Cumulative Realized P&L"
      icon={LineChart}
      className="col-span-full lg:col-span-8"
      noBodyPadding
    >
      <PerformanceChart portfolioValues={series} loading={transactions.isLoading} height={240} />
    </DashboardPanel>
  );
}
