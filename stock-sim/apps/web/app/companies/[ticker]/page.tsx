"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { CompanyHeader, CompanyHeaderSkeleton } from "@/components/companies/CompanyHeader";
import { ExecutiveTearSheet } from "@/components/companies/ExecutiveTearSheet";
import { PriceChart, type IndicatorKey } from "@/components/charts/PriceChart";
import { ChartControls, sliceByTimeframe, type TimeframeKey } from "@/components/companies/ChartControls";
import type { ChartType } from "@/lib/charts/types";
import { DriverChart } from "@/components/charts/DriverChart";
import { ValuationCard } from "@/components/companies/ValuationCard";
import { FinancialTabs } from "@/components/companies/FinancialTabs";
import { PeerCompaniesSection } from "@/components/companies/PeerCompaniesSection";
import { CompanyNewsSection } from "@/components/companies/CompanyNewsSection";
import { OrderForm } from "@/components/trading/OrderForm";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany, useDrivers, useFinancials, usePriceHistory, useValuation } from "@/lib/api/hooks/useCompany";
import { usePortfolio } from "@/lib/api/hooks/usePortfolio";
import { ApiError } from "@/lib/api/client";

export default function CompanyDetailPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = (params.ticker ?? "").toUpperCase();

  const [timeframe, setTimeframe] = React.useState<TimeframeKey>("ALL");
  const [indicators, setIndicators] = React.useState<IndicatorKey[]>([]);
  const [showVolumeProfile, setShowVolumeProfile] = React.useState(false);
  const [chartType, setChartType] = React.useState<ChartType>("candlestick");
  const [activeOverlays, setActiveOverlays] = React.useState<string[]>([]);

  function toggleIndicator(key: IndicatorKey) {
    setIndicators((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleOverlay(id: string) {
    setActiveOverlays((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function clearOverlays() {
    setActiveOverlays([]);
  }

  const company = useCompany(ticker);
  const history = usePriceHistory(ticker);
  const drivers = useDrivers(ticker);
  const financials = useFinancials(ticker);
  const valuation = useValuation(ticker);
  const portfolio = usePortfolio();

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
              loading={company.isLoading}
            />

            <DashboardPanel eyebrow="Market Data" title="Price">
              <ChartControls
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                indicators={indicators}
                onToggleIndicator={toggleIndicator}
                showVolumeProfile={showVolumeProfile}
                onToggleVolumeProfile={() => setShowVolumeProfile((v) => !v)}
                chartType={chartType}
                onChartTypeChange={setChartType}
                activeOverlays={activeOverlays}
                onToggleOverlay={toggleOverlay}
                onClearOverlays={clearOverlays}
              />
              <PriceChart
                data={sliceByTimeframe(history.data ?? [], timeframe)}
                loading={history.isLoading}
                error={history.isError}
                onRetry={() => history.refetch()}
                ticker={ticker}
                indicators={indicators}
                showVolumeProfile={showVolumeProfile}
                chartType={chartType}
              />
            </DashboardPanel>

            <DashboardPanel eyebrow="Signal" title="Price Drivers">
              {drivers.isLoading ? (
                <Skeleton height={140} className="w-full" />
              ) : (
                <DriverChart drivers={drivers.data ?? []} />
              )}
            </DashboardPanel>

            <FinancialTabs financials={financials.data} loading={financials.isLoading} />

            <PeerCompaniesSection ticker={ticker} industryName={company.data.industry_name} />

            <CompanyNewsSection companyId={company.data.id} ticker={ticker} />
          </div>

          <div className="flex flex-col gap-4">
            <ValuationCard valuation={valuation.data} loading={valuation.isLoading} />
            <OrderForm
              ticker={ticker}
              currentPrice={currentPrice}
              cashBalance={portfolio.data ? Number(portfolio.data.cash_balance) : 0}
              sharesHeld={holding?.quantity ?? 0}
              isPortfolioLoading={portfolio.isLoading}
              onOrderPlaced={() => {
                company.refetch();
                portfolio.refetch();
              }}
            />
          </div>
        </div>
      )}
    </TerminalShell>
  );
}
