import { Award, Percent, TrendingDown, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import type { PortfolioAnalyticsResponse } from "@/lib/api/types";

export interface AnalyticsCardsProps {
  analytics: PortfolioAnalyticsResponse | undefined;
  loading?: boolean;
}

export function AnalyticsCards({ analytics, loading }: AnalyticsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Win Rate"
        value={analytics?.win_rate != null ? analytics.win_rate : "N/A"}
        format={analytics?.win_rate != null ? "pct" : "text"}
        icon={Percent}
        loading={loading}
      />
      <StatCard
        label="Total Return"
        value={analytics?.total_return_pct ?? 0}
        format="pct"
        trend={analytics && analytics.total_return_pct >= 0 ? "up" : "down"}
        icon={TrendingUp}
        loading={loading}
      />
      <StatCard
        label="Realized PnL"
        value={analytics ? Number(analytics.realized_pnl) : 0}
        format="price"
        trend={analytics && Number(analytics.realized_pnl) >= 0 ? "up" : "down"}
        icon={Award}
        loading={loading}
      />
      <StatCard
        label="Cash Allocation"
        value={analytics?.cash_allocation_pct ?? 0}
        format="pct"
        icon={TrendingDown}
        loading={loading}
      />
    </div>
  );
}
