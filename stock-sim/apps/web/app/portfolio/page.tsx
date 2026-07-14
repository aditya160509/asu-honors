"use client";

import * as React from "react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useStaggerReveal } from "@/lib/dashboard/useStaggerReveal";
import { usePortfolio, usePortfolioAnalytics, useTransactions } from "@/lib/api/hooks/usePortfolio";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { PortfolioHealthStrip } from "@/components/portfolio/PortfolioHealthStrip";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { AllocationStudio } from "@/components/portfolio/AllocationStudio";
import { RiskExposureSection } from "@/components/portfolio/RiskExposureSection";
import { TransactionTimeline } from "@/components/portfolio/TransactionTimeline";
import { PortfolioIntelligence } from "@/components/portfolio/PortfolioIntelligence";
import { WatchlistPreviewSection } from "@/components/dashboard/WatchlistPreviewSection";
import { QuickActionsSection } from "@/components/dashboard/QuickActionsSection";

const TRANSACTIONS_PAGE_SIZE = 25;

/**
 * Institutional portfolio management workspace. Composition follows the five questions a portfolio
 * manager actually asks, in order: performance (Hero) -> why (Health Strip + Holdings) -> risk
 * (Risk & Exposure) -> opportunity (Allocation Studio, Risk & Exposure winners/losers) -> what next
 * (Intelligence, Watchlist, Quick Actions). Layout is a 12-column grid with each module owning its
 * own col-span (same convention as components/dashboard/DashboardGrid.tsx) so the page reads as an
 * asymmetric composition — one full-width protagonist (Hero), not a uniform tile grid.
 */
export default function PortfolioPage() {
  const portfolio = usePortfolio();
  const analytics = usePortfolioAnalytics();
  const [transactionsLimit, setTransactionsLimit] = React.useState(TRANSACTIONS_PAGE_SIZE);
  const transactions = useTransactions(undefined, transactionsLimit);
  const market = useMarketGrid();

  const containerRef = useStaggerReveal<HTMLDivElement>();

  const totalValue = portfolio.data ? Number(portfolio.data.total_value) : 0;
  const allocation = analytics.data?.allocation_by_sector ?? [];
  const companies = market.data?.companies ?? [];

  return (
    <TerminalShell>
      <PageHeader title="Portfolio" description="Holdings, performance, and risk for your active timeline." />

      <div ref={containerRef} className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="col-span-full">
          <PortfolioHero
            portfolio={portfolio.data}
            analytics={analytics.data}
            transactions={transactions.data ?? []}
            loading={portfolio.isLoading}
            transactionsLoading={transactions.isLoading}
            isError={portfolio.isError}
            onRetry={() => portfolio.refetch()}
          />
        </div>

        <div className="col-span-full">
          <PortfolioHealthStrip
            portfolio={portfolio.data}
            analytics={analytics.data}
            companies={companies}
            loading={portfolio.isLoading || analytics.isLoading}
          />
        </div>

        <div className="col-span-full">
          <HoldingsTable
            holdings={portfolio.data?.holdings ?? []}
            totalValue={totalValue}
            loading={portfolio.isLoading}
            error={portfolio.isError}
            onRetry={() => portfolio.refetch()}
          />
        </div>

        <div className="col-span-full lg:col-span-6">
          <AllocationStudio allocation={allocation} loading={analytics.isLoading} />
        </div>
        <div className="col-span-full lg:col-span-6">
          <RiskExposureSection holdings={portfolio.data?.holdings ?? []} totalValue={totalValue} loading={portfolio.isLoading} />
        </div>

        <div className="col-span-full lg:col-span-8">
          <TransactionTimeline
            transactions={transactions.data ?? []}
            loading={transactions.isLoading}
            error={transactions.isError}
            onRetry={() => transactions.refetch()}
            hasMore={(transactions.data?.length ?? 0) >= transactionsLimit}
            loadingMore={transactions.isFetching && !transactions.isLoading}
            onLoadMore={() => setTransactionsLimit((n) => n + TRANSACTIONS_PAGE_SIZE)}
          />
        </div>
        <div className="col-span-full lg:col-span-4">
          <PortfolioIntelligence portfolio={portfolio.data} analytics={analytics.data} loading={portfolio.isLoading || analytics.isLoading} />
        </div>

        <WatchlistPreviewSection />
        <QuickActionsSection />
      </div>
    </TerminalShell>
  );
}
