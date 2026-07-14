"use client";

import { useStaggerReveal } from "@/lib/dashboard/useStaggerReveal";
import { PortfolioSummarySection } from "@/components/dashboard/PortfolioSummarySection";
import { KpiCardsSection } from "@/components/dashboard/KpiCardsSection";
import { LiveMarketTickerSection } from "@/components/dashboard/LiveMarketTickerSection";
import { GlobalMarketsSection } from "@/components/dashboard/GlobalMarketsSection";
import { MarketOverviewSection } from "@/components/dashboard/MarketOverviewSection";
import { PortfolioPerformanceSection } from "@/components/dashboard/PortfolioPerformanceSection";
import { AiInsightSection } from "@/components/dashboard/AiInsightSection";
import { TrendingCompaniesSection } from "@/components/dashboard/TrendingCompaniesSection";
import { WatchlistPreviewSection } from "@/components/dashboard/WatchlistPreviewSection";
import { SectorPerformanceSection } from "@/components/dashboard/SectorPerformanceSection";
import { TopMoversSection } from "@/components/dashboard/TopMoversSection";
import { RecentActivitySection } from "@/components/dashboard/RecentActivitySection";
import { MarketHeatmapSection } from "@/components/dashboard/MarketHeatmapSection";
import { QuickActionsSection } from "@/components/dashboard/QuickActionsSection";
import { EconomicCalendarSection } from "@/components/dashboard/EconomicCalendarSection";

/**
 * 12-column modular grid (DESIGN_SPEC Dashboard). Every section owns its own
 * `col-span-*` so this file is pure composition/order — the actual
 * cards/logic live one level down, one file each ("no giant components").
 */
export function DashboardGrid() {
  const containerRef = useStaggerReveal<HTMLDivElement>();

  return (
    <div ref={containerRef} className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <PortfolioSummarySection />
      <KpiCardsSection />

      <LiveMarketTickerSection />

      <GlobalMarketsSection />
      <MarketOverviewSection />

      <PortfolioPerformanceSection />
      <AiInsightSection />

      <TrendingCompaniesSection />
      <WatchlistPreviewSection />
      <SectorPerformanceSection />

      <TopMoversSection />
      <RecentActivitySection />

      <MarketHeatmapSection />
      <QuickActionsSection />

      <EconomicCalendarSection />
    </div>
  );
}
