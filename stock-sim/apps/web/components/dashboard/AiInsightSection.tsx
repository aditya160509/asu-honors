"use client";

import { AlertTriangle, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { usePortfolio, usePortfolioAnalytics } from "@/lib/api/hooks/usePortfolio";
import { useCycleState, useMarketGrid } from "@/lib/api/hooks/useMarket";
import { marketOverviewStats } from "@/lib/dashboard/marketAggregates";
import { generateInsights } from "@/lib/dashboard/generateInsights";
import type { Insight, InsightTone } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";

const TONE_ICON: Record<InsightTone, typeof TrendingUp> = {
  positive: TrendingUp,
  negative: TrendingDown,
  warning: AlertTriangle,
  neutral: Sparkles,
};

const TONE_CLASS: Record<InsightTone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning",
  neutral: "text-mer-accent-300",
};

function InsightRow({ insight }: { insight: Insight }) {
  const Icon = TONE_ICON[insight.tone];
  return (
    <div className="flex items-start gap-2.5 py-2.5">
      <Icon size={14} className={cn("mt-0.5 shrink-0", TONE_CLASS[insight.tone])} />
      <div className="min-w-0 flex-1">
        <p className="text-small leading-relaxed text-mer-ink-primary">{insight.text}</p>
        <Badge variant="default" className="mt-1.5">
          {insight.sourceLabel}
        </Badge>
      </div>
    </div>
  );
}

/**
 * DESIGN_SPEC's "AI card" — iris top edge, ✦ badge header. There is no
 * generative-AI backend in this app, so the copy is a deterministic
 * rule-based read of live portfolio/market/cycle state (lib/dashboard/
 * generateInsights.ts) rather than fabricated narrative text — every
 * sentence names the real number it came from.
 */
export function AiInsightSection() {
  const portfolio = usePortfolio();
  const analytics = usePortfolioAnalytics();
  const cycle = useCycleState();
  const market = useMarketGrid();

  const loading = portfolio.isLoading || analytics.isLoading || cycle.isLoading || market.isLoading;
  const marketStats = market.data ? marketOverviewStats(market.data.companies) : undefined;
  const insights = generateInsights({
    portfolio: portfolio.data,
    analytics: analytics.data,
    cycle: cycle.data,
    marketStats,
  });

  return (
    <DashboardPanel
      eyebrow="✦ Insight Panel"
      title="Live Signals"
      icon={Sparkles}
      edge="iris"
      className="col-span-full lg:col-span-4"
      bodyClassName="p-4"
      actions={
        <Badge variant="default" className="border border-[color:var(--mer-stroke-hairline)] text-[#8b7cf6]">
          Derived
        </Badge>
      }
    >
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton width="100%" height={14} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="90%" height={14} />
        </div>
      ) : insights.length === 0 ? (
        <EmptyState title="Not enough activity yet." description="Trade or advance the simulation to generate signals." />
      ) : (
        <div className="flex flex-col divide-y divide-[color:var(--mer-stroke-hairline)]">
          {insights.map((insight) => (
            <InsightRow key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}
