"use client";

import * as React from "react";
import { LineChart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { DeltaBadge } from "@/components/dashboard/primitives/DeltaBadge";
import { RangeSelector } from "@/components/dashboard/primitives/RangeSelector";
import { useAnimatedCounter } from "@/lib/motion";
import { cumulativeRealizedPnl } from "@/lib/dashboard/portfolioPerformance";
import { cn, formatPrice } from "@/lib/utils";
import type { PortfolioAnalyticsResponse, PortfolioResponse, TransactionItem } from "@/lib/api/types";

type Range = "1M" | "3M" | "6M" | "1Y" | "ALL";

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "1Y", label: "1Y" },
  { value: "ALL", label: "All" },
];

const RANGE_DAYS: Record<Exclude<Range, "ALL">, number> = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };

function filterByRange(transactions: TransactionItem[], range: Range): TransactionItem[] {
  if (range === "ALL") return transactions;
  const cutoff = Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  return transactions.filter((t) => new Date(t.sim_date).getTime() >= cutoff);
}

export interface PortfolioHeroProps {
  portfolio: PortfolioResponse | undefined;
  analytics: PortfolioAnalyticsResponse | undefined;
  transactions: TransactionItem[];
  loading?: boolean;
  transactionsLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

/**
 * The hero — the one protagonist module. There is no daily portfolio NAV snapshot endpoint (see
 * lib/dashboard/portfolioPerformance.ts), so the chart is honestly labeled "Cumulative Realized
 * P&L" rather than implying it's a total-value curve, and there's no benchmark/index series
 * anywhere in the backend to compare against — omitted rather than fabricated. The headline delta
 * uses `total_return_pct` (since inception) — `portfolio.day_change_pct` is deliberately not shown
 * here: it's computed against a portfolio-value snapshot frozen at account creation, i.e. the same
 * basis as total_return_pct, so surfacing both would silently duplicate one number under two labels.
 */
export function PortfolioHero({
  portfolio,
  analytics,
  transactions,
  loading,
  transactionsLoading,
  isError,
  onRetry,
}: PortfolioHeroProps) {
  const [range, setRange] = React.useState<Range>("ALL");
  const totalValue = portfolio ? Number(portfolio.total_value) : 0;
  const display = useAnimatedCounter(totalValue, formatPrice);
  const series = React.useMemo(() => cumulativeRealizedPnl(filterByRange(transactions, range)), [transactions, range]);
  const unrealized = analytics ? Number(analytics.unrealized_pnl) : 0;

  return (
    <DashboardPanel eyebrow="Portfolio Pulse" title="Net Portfolio Value" icon={LineChart} live edge="accent" noBodyPadding>
      <div className="flex flex-col gap-5 p-5">
        {isError ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-small text-mer-ink-secondary">Couldn&apos;t load your portfolio.</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : loading ? (
          <Skeleton width={260} height={52} />
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-3">
                <span className="num text-[2.5rem] font-semibold leading-none text-mer-ink-primary">{display}</span>
                <DeltaBadge value={analytics?.total_return_pct} size="md" />
              </div>
              <span className="text-micro text-mer-ink-tertiary">Total return since inception</span>
            </div>
            <div className="flex gap-6">
              <div className="flex flex-col gap-0.5">
                <span className="text-micro uppercase tracking-wide text-mer-ink-tertiary">Cash</span>
                <span className="num text-body text-mer-ink-secondary">{formatPrice(portfolio?.cash_balance ?? 0)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-micro uppercase tracking-wide text-mer-ink-tertiary">Positions</span>
                <span className="num text-body text-mer-ink-secondary">{portfolio?.holdings.length ?? 0}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-micro uppercase tracking-wide text-mer-ink-tertiary">Unrealized P&amp;L</span>
                <span className={cn("num text-body", unrealized >= 0 ? "text-positive" : "text-negative")}>
                  {formatPrice(unrealized)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[color:var(--mer-stroke-hairline)] px-5 py-2.5">
        <span className="text-micro uppercase tracking-wide text-mer-ink-tertiary">Cumulative Realized P&amp;L</span>
        <RangeSelector options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </div>
      <PerformanceChart portfolioValues={series} loading={transactionsLoading} height={260} />
    </DashboardPanel>
  );
}
