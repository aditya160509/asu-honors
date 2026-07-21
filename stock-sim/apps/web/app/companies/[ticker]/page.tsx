"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { CompanyHeader, CompanyHeaderSkeleton } from "@/components/companies/CompanyHeader";
import { ExecutiveTearSheet } from "@/components/companies/ExecutiveTearSheet";
import { PriceChart, type IndicatorKey } from "@/components/charts/PriceChart";
import { IndicatorSubChart } from "@/components/charts/IndicatorSubChart";
import { DrawingToolbar } from "@/components/ui/DrawingToolbar";
import { DrawingManager } from "@/lib/charts/drawing/DrawingManager";
import { INDICATOR_REGISTRY, type IndicatorType } from "@/lib/charts/indicators";
import type { DrawingToolType } from "@/lib/charts/drawing/types";
import type { VisibleRange } from "@/lib/charts/types";
import { ChartControls, sliceByTimeframe, type TimeframeKey } from "@/components/companies/ChartControls";
import type { ChartType } from "@/lib/charts/types";
import { DriverChart } from "@/components/charts/DriverChart";
import { ValuationCard } from "@/components/companies/ValuationCard";
import { FinancialTabs } from "@/components/companies/FinancialTabs";
import { PeerCompaniesSection } from "@/components/companies/PeerCompaniesSection";
import { CompanyNewsSection } from "@/components/companies/CompanyNewsSection";
import { OrderForm } from "@/components/trading/OrderForm";
import { PriceAlertPanel } from "@/components/trading/PriceAlertPanel";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany, useDrivers, useFinancials, usePriceHistory, useValuation } from "@/lib/api/hooks/useCompany";
import { usePortfolio } from "@/lib/api/hooks/usePortfolio";
import { useConCalls } from "@/lib/api/hooks/useConCalls";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { buildConCallMarkers } from "@/lib/companies/conCallMarkers";
import { computeRiskTierCutoffs, riskTierFor } from "@/lib/market/riskTier";
import { logCompanyView } from "@/lib/companies/useRecentlyViewed";
import { ApiError } from "@/lib/api/client";

export default function CompanyDetailPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = (params.ticker ?? "").toUpperCase();

  const [timeframe, setTimeframe] = React.useState<TimeframeKey>("ALL");
  const [showVolumeProfile, setShowVolumeProfile] = React.useState(false);
  const [chartType, setChartType] = React.useState<ChartType>("candlestick");
  const [activeOverlays, setActiveOverlays] = React.useState<IndicatorType[]>(["sma20"]);
  const [drawingManager] = React.useState(() => new DrawingManager());
  const [activeDrawingTool, setActiveDrawingTool] = React.useState<DrawingToolType | null>(null);
  const [chartRange, setChartRange] = React.useState<VisibleRange>({ from: 0, to: 0 });

  function toggleOverlay(type: IndicatorType) {
    setActiveOverlays((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  React.useEffect(() => {
    return drawingManager.subscribe(() => setActiveDrawingTool(drawingManager.activeTool));
  }, [drawingManager]);

  const priceIndicators = React.useMemo(
    () => activeOverlays.filter((t): t is IndicatorKey => INDICATOR_REGISTRY[t].type === "overlay"),
    [activeOverlays]
  );
  const paneIndicators = React.useMemo(
    () => activeOverlays.filter((t) => INDICATOR_REGISTRY[t].type === "subchart").slice(0, 3),
    [activeOverlays]
  );

  const company = useCompany(ticker);
  const history = usePriceHistory(ticker);
  const drivers = useDrivers(ticker);
  const financials = useFinancials(ticker);
  const valuation = useValuation(ticker);
  const portfolio = usePortfolio();
  const conCalls = useConCalls({ ticker, limit: 8 });
  const marketGrid = useMarketGrid();

  const riskTierCutoffs = React.useMemo(
    () => computeRiskTierCutoffs((marketGrid.data?.companies ?? []).map((c) => Number(c.volatility)).filter((v) => !Number.isNaN(v))),
    [marketGrid.data]
  );
  const riskTier = riskTierFor(company.data?.volatility != null ? Number(company.data.volatility) : null, riskTierCutoffs);

  React.useEffect(() => {
    // Keyed on ticker/name (not the whole company.data object) so this fires
    // once per navigation, not on every background refetch of live price data.
    if (company.data) logCompanyView(company.data.ticker, company.data.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.data?.ticker, company.data?.name]);

  const chartData = React.useMemo(() => sliceByTimeframe(history.data ?? [], timeframe), [history.data, timeframe]);
  const conCallMarkers = React.useMemo(
    () => buildConCallMarkers(conCalls.data ?? [], chartData),
    [conCalls.data, chartData]
  );

  if (company.isError && company.error instanceof ApiError && company.error.status === 404) {
    return (
      <TerminalShell>
        <ErrorState title={`Company '${ticker}' not found`} />
        <div className="mt-2 text-center">
          <Link href="/market" className="text-small text-mer-accent-500 hover:text-mer-accent-300">
            Back to market
          </Link>
        </div>
      </TerminalShell>
    );
  }

  if (company.isError) {
    return (
      <TerminalShell>
        <ErrorState message="Could not load company." onRetry={() => company.refetch()} />
      </TerminalShell>
    );
  }

  const holding = portfolio.data?.holdings.find((h) => h.ticker === ticker);
  const currentPrice = company.data?.latest_price ? Number(company.data.latest_price) : null;
  const latestBar = history.data && history.data.length > 0 ? history.data[history.data.length - 1] : undefined;
  const dayChangePct =
    history.data && history.data.length >= 2
      ? ((Number(history.data[history.data.length - 1].close) - Number(history.data[history.data.length - 2].close)) /
          Number(history.data[history.data.length - 2].close)) *
        100
      : null;

  return (
    <TerminalShell>
      {company.isLoading || !company.data ? (
        <CompanyHeaderSkeleton />
      ) : (
        <CompanyHeader company={company.data} dayChangePct={dayChangePct} history={history.data} />
      )}

      {company.data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-4">
            <ExecutiveTearSheet
              company={company.data}
              latestBar={latestBar}
              dayChangePct={dayChangePct}
              riskTier={riskTier}
              loading={company.isLoading}
            />

            <DashboardPanel eyebrow="Market Data" title="Price">
              <ChartControls
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                activeIndicators={activeOverlays}
                onToggleIndicator={toggleOverlay}
                showVolumeProfile={showVolumeProfile}
                onToggleVolumeProfile={() => setShowVolumeProfile((v) => !v)}
                chartType={chartType}
                onChartTypeChange={setChartType}
              />
              <div className="flex gap-2">
                <div className="w-11 shrink-0 overflow-hidden rounded-md border border-[var(--mer-stroke-hairline)]">
                  <DrawingToolbar manager={drawingManager} />
                </div>
                <div className="min-w-0 flex-1">
                  <PriceChart
                    data={chartData}
                    loading={history.isLoading}
                    error={history.isError}
                    onRetry={() => history.refetch()}
                    ticker={ticker}
                    indicators={priceIndicators}
                    showVolumeProfile={showVolumeProfile}
                    chartType={chartType}
                    drawingManager={drawingManager}
                    activeDrawingTool={activeDrawingTool}
                    events={conCallMarkers}
                    externalRange={chartRange.to > chartRange.from ? chartRange : undefined}
                    onRangeChange={setChartRange}
                  />
                  {paneIndicators.length > 0 && (
                    <div
                      className="mt-2 grid gap-2"
                      style={{ gridTemplateColumns: `repeat(${paneIndicators.length}, minmax(0, 1fr))` }}
                    >
                      {paneIndicators.map((type) => (
                        <div key={type} className="overflow-hidden rounded-sm border border-[var(--mer-stroke-hairline)]">
                          <IndicatorSubChart
                            type={type}
                            data={chartData}
                            height={96}
                            range={chartRange.to > chartRange.from ? chartRange : { from: 0, to: chartData.length }}
                            onRangeChange={setChartRange}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel eyebrow="Signal" title="Price Drivers">
              {drivers.isLoading ? (
                <Skeleton height={140} className="w-full" />
              ) : (
                <DriverChart drivers={drivers.data ?? []} />
              )}
            </DashboardPanel>

            <FinancialTabs
              ticker={ticker}
              company={company.data}
              financials={financials.data}
              loading={financials.isLoading}
            />

            <PeerCompaniesSection ticker={ticker} industryName={company.data.industry_name} />

            <CompanyNewsSection companyId={company.data.id} ticker={ticker} />
          </div>

          <div className="flex flex-col gap-4">
            <ValuationCard
              valuation={valuation.data}
              eps={financials.data?.income_statement?.eps as number | undefined}
              loading={valuation.isLoading}
            />
            <OrderForm
              ticker={ticker}
              currentPrice={currentPrice}
              cashBalance={portfolio.data ? Number(portfolio.data.cash_balance) : 0}
              sharesHeld={holding?.quantity ?? 0}
              isPortfolioLoading={portfolio.isLoading}
              holdings={portfolio.data?.holdings}
              totalPortfolioValue={portfolio.data ? Number(portfolio.data.total_value) : undefined}
              onOrderPlaced={() => {
                company.refetch();
                portfolio.refetch();
              }}
            />
            <PriceAlertPanel companyId={company.data.id} ticker={ticker} currentPrice={currentPrice} />
          </div>
        </div>
      )}
    </TerminalShell>
  );
}
