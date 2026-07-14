"use client";

import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { InsightList } from "@/components/dashboard/primitives/InsightRow";
import { generateInsights } from "@/lib/dashboard/generateInsights";
import type { PortfolioAnalyticsResponse, PortfolioResponse } from "@/lib/api/types";

export interface PortfolioIntelligenceProps {
  portfolio: PortfolioResponse | undefined;
  analytics: PortfolioAnalyticsResponse | undefined;
  loading?: boolean;
}

/**
 * DESIGN_SPEC's "AI card" (edge="iris"), reusing the exact same deterministic, rule-based
 * `generateInsights` used by the Dashboard's own insight panel — called here with only
 * portfolio/analytics (no marketStats/cycle), which naturally omits the market-comparison insight
 * that depends on `day_change_pct` (a field this redesign treats as unreliable — see PortfolioHero).
 * Every sentence still cites a real number; nothing is generated text.
 */
export function PortfolioIntelligence({ portfolio, analytics, loading }: PortfolioIntelligenceProps) {
  const insights = generateInsights({ portfolio, analytics });

  return (
    <DashboardPanel
      eyebrow="✦ Insight Panel"
      title="Portfolio Intelligence"
      icon={Sparkles}
      edge="iris"
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
        <EmptyState title="Not enough activity yet." description="Trade to generate portfolio signals." />
      ) : (
        <InsightList insights={insights} />
      )}
    </DashboardPanel>
  );
}
