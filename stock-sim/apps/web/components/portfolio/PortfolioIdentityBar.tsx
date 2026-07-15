"use client";

import * as React from "react";
import { LiveDot } from "@/components/dashboard/primitives/LiveDot";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { usePortfolio, usePortfolioAnalytics, useTransactions } from "@/lib/api/hooks/usePortfolio";
import { useSimState } from "@/lib/api/hooks/useSimulation";
import { usePortfolioHeader } from "@/components/portfolio/PortfolioHeaderContext";
import { useAnimatedCounter } from "@/lib/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatPrice } from "@/lib/utils";

/**
 * C0 identity bar: eyebrow → display-xl mono net value → delta line → session
 * badge. Range-aware: the Performance tab publishes its selected range's delta
 * via PortfolioHeaderContext; every other tab shows since-inception.
 * A brand-new account (no holdings, no transactions) omits the delta line
 * entirely rather than showing a meaningless +0.00%.
 */
export function PortfolioIdentityBar() {
  const portfolio = usePortfolio();
  const analytics = usePortfolioAnalytics();
  const transactions = useTransactions(undefined, 1);
  const sim = useSimState();
  const { rangeDelta } = usePortfolioHeader();

  const totalValue = portfolio.data ? Number(portfolio.data.total_value) : 0;
  const display = useAnimatedCounter(totalValue, formatPrice);

  const isBrandNew =
    !portfolio.isLoading &&
    (portfolio.data?.holdings.length ?? 0) === 0 &&
    (transactions.data?.length ?? 0) === 0;

  const delta = rangeDelta ?? {
    label: "since inception",
    deltaValue: analytics.data ? Number(analytics.data.total_value) - totalReturnBase(analytics.data.total_value, analytics.data.total_return_pct) : 0,
    deltaPct: analytics.data?.total_return_pct ?? 0,
  };
  const deltaPositive = delta.deltaPct >= 0;

  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 border-b pb-4", MER_HAIRLINE)}>
      <div className="flex flex-col gap-1">
        <span className="text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">Portfolio</span>
        {portfolio.isLoading ? (
          <Skeleton width={280} height={44} />
        ) : (
          <span className="num text-[2.5rem] font-semibold leading-[1.1] text-mer-ink-primary">{display}</span>
        )}
        {!portfolio.isLoading && !isBrandNew && analytics.data && (
          <span className="flex items-baseline gap-2">
            <span className={cn("num text-small font-medium", deltaPositive ? "text-positive" : "text-negative")}>
              {deltaPositive ? "▲" : "▼"} {deltaPositive ? "+" : "−"}
              {formatPrice(Math.abs(delta.deltaValue))} ({deltaPositive ? "+" : "−"}
              {Math.abs(delta.deltaPct).toFixed(2)}%)
            </span>
            <span className="text-micro text-mer-ink-tertiary">{delta.label}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 pb-1">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-mer-xs border px-2 py-1 text-micro font-medium uppercase tracking-wide",
            MER_HAIRLINE,
            "bg-mer-surface-3 text-mer-ink-secondary"
          )}
        >
          {sim.data?.is_running && <LiveDot />}
          {sim.data?.is_running ? "Market Live" : "Market Paused"}
        </span>
      </div>
    </div>
  );
}

/** Back out the inception base from (total, return%) so the $ delta matches the % the API reports. */
function totalReturnBase(totalValue: number | string, returnPct: number): number {
  const total = Number(totalValue);
  if (returnPct === -100) return total;
  return total / (1 + returnPct / 100);
}
