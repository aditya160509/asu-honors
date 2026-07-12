"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { AllocationChart } from "@/components/charts/AllocationChart";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { AnalyticsCards } from "@/components/portfolio/AnalyticsCards";
import { usePortfolio, usePortfolioAnalytics, useTransactions } from "@/lib/api/hooks/usePortfolio";
import { formatPrice } from "@/lib/utils";

const SECTOR_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#6b7280"];

export default function PortfolioPage() {
  const portfolio = usePortfolio();
  const analytics = usePortfolioAnalytics();
  const transactions = useTransactions();

  const allocation = (analytics.data?.allocation_by_sector ?? []).map((s, i) => ({
    label: s.sector,
    value: Number(s.value),
    color: SECTOR_COLORS[i % SECTOR_COLORS.length],
  }));

  const performanceSeries =
    transactions.data
      ?.slice()
      .reverse()
      .map((t, i) => ({ time: new Date(t.sim_date).getTime(), value: i })) ?? [];

  return (
    <TerminalShell>
      <h1 className="text-h2 font-semibold text-text-primary mb-4">Portfolio</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Value" value={portfolio.data ? Number(portfolio.data.total_value) : 0} format="price" loading={portfolio.isLoading} size="lg" />
        <StatCard label="Cash Balance" value={portfolio.data ? Number(portfolio.data.cash_balance) : 0} format="price" loading={portfolio.isLoading} />
        <StatCard
          label="Day Change"
          value={portfolio.data?.day_change_pct ?? 0}
          format="pct"
          trend={portfolio.data?.day_change_pct != null && portfolio.data.day_change_pct >= 0 ? "up" : "down"}
          loading={portfolio.isLoading}
        />
        <StatCard
          label="Total Return"
          value={analytics.data?.total_return_pct ?? 0}
          format="pct"
          trend={analytics.data && analytics.data.total_return_pct >= 0 ? "up" : "down"}
          loading={analytics.isLoading}
        />
      </div>

      <AnalyticsCards analytics={analytics.data} loading={analytics.isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mt-4">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <HoldingsTable holdings={portfolio.data?.holdings ?? []} loading={portfolio.isLoading} error={portfolio.isError} onRetry={() => portfolio.refetch()} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart portfolioValues={performanceSeries} loading={transactions.isLoading} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(transactions.data ?? []).length === 0 && !transactions.isLoading && (
                <p className="text-small text-text-tertiary">No transactions yet.</p>
              )}
              {(transactions.data ?? []).map((t) => (
                <div key={t.id} className="flex justify-between text-small border-b border-border py-1.5 last:border-0">
                  <span className="text-text-tertiary num">{t.sim_date}</span>
                  <span className={t.side === "buy" ? "text-positive" : "text-negative"}>{t.side.toUpperCase()}</span>
                  <span className="num text-text-primary">
                    {t.quantity} {t.ticker}
                  </span>
                  <span className="num text-text-primary">{formatPrice(Number(t.price))}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationChart data={allocation} loading={analytics.isLoading} />
          </CardContent>
        </Card>
      </div>
    </TerminalShell>
  );
}
