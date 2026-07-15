"use client";

import { Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAnimatedCounter } from "@/lib/motion";
import { cssVar, formatPrice } from "@/lib/utils";
import { usePortfolio, useTransactions } from "@/lib/api/hooks/usePortfolio";
import { cumulativeRealizedPnl } from "@/lib/dashboard/portfolioPerformance";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { DeltaBadge } from "@/components/dashboard/primitives/DeltaBadge";
import { MiniAreaSpark } from "@/components/dashboard/primitives/MiniAreaSpark";

/** The "Portfolio Pulse" hero — DESIGN_SPEC Dashboard hero module. */
export function PortfolioSummarySection() {
  const portfolio = usePortfolio();
  const transactions = useTransactions(undefined, 60);
  const spark = cumulativeRealizedPnl(transactions.data ?? []);

  const totalValue = portfolio.data ? Number(portfolio.data.total_value) : 0;
  const display = useAnimatedCounter(totalValue, formatPrice);

  return (
    <DashboardPanel
      eyebrow="Portfolio Pulse"
      title="Net Portfolio Value"
      icon={Wallet}
      live
      edge="accent"
      className="col-span-full lg:col-span-8"
      noBodyPadding
    >
      <div className="flex flex-col gap-4 p-4">
        {portfolio.isError ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-small text-mer-ink-secondary">Couldn&apos;t load your portfolio.</p>
            <Button variant="outline" size="sm" onClick={() => portfolio.refetch()}>
              Retry
            </Button>
          </div>
        ) : portfolio.isLoading ? (
          <Skeleton width={220} height={44} />
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <span className="num text-[2.5rem] font-semibold leading-none text-mer-ink-primary">{display}</span>
              <DeltaBadge value={portfolio.data?.day_change_pct} size="md" />
            </div>
            <div className="flex gap-6">
              <div className="flex flex-col gap-0.5">
                <span className="text-micro uppercase text-mer-ink-tertiary">Cash</span>
                <span className="num text-body text-mer-ink-secondary">
                  {formatPrice(portfolio.data?.cash_balance ?? 0)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-micro uppercase text-mer-ink-tertiary">Positions</span>
                <span className="num text-body text-mer-ink-secondary">{portfolio.data?.holdings.length ?? 0}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      {spark.length >= 2 && (
        <div className="border-t border-[color:var(--mer-stroke-hairline)]">
          <MiniAreaSpark data={spark} height={64} color={cssVar('--accent')} />
        </div>
      )}
    </DashboardPanel>
  );
}
