"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Briefcase } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { EmptyState } from "@/components/ui/empty-state";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { PortfolioHealthStrip } from "@/components/portfolio/PortfolioHealthStrip";
import { usePortfolio, usePortfolioAnalytics } from "@/lib/api/hooks/usePortfolio";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";

/** C1 — Holdings: the dense positions grid plus the health strip above it. */
export default function HoldingsPage() {
  const router = useRouter();
  const portfolio = usePortfolio();
  const analytics = usePortfolioAnalytics();
  const market = useMarketGrid();

  const holdings = portfolio.data?.holdings ?? [];
  const isEmpty = !portfolio.isLoading && !portfolio.isError && holdings.length === 0;

  if (isEmpty) {
    return (
      <DashboardPanel eyebrow="Holdings" title="Build your first position" icon={Briefcase}>
        <EmptyState
          title="Build your first position"
          description="Your holdings will appear here once you place a trade."
          action={{ label: "Explore the market", onClick: () => router.push("/market") }}
        />
      </DashboardPanel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PortfolioHealthStrip
        portfolio={portfolio.data}
        analytics={analytics.data}
        companies={market.data?.companies ?? []}
        loading={portfolio.isLoading || analytics.isLoading}
      />
      <HoldingsTable
        holdings={holdings}
        totalValue={portfolio.data ? Number(portfolio.data.total_value) : 0}
        loading={portfolio.isLoading}
        error={portfolio.isError}
        onRetry={() => portfolio.refetch()}
      />
    </div>
  );
}
