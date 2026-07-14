"use client";

import { Activity } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { MetricStrip, type MetricStripItem } from "@/components/dashboard/primitives/MetricStrip";
import { hhiLabel, sectorHHI, singleNameConcentrationPct, weightedVolatility, withWeights } from "@/lib/portfolio/holdingsMath";
import type { CompanyGridItem, PortfolioAnalyticsResponse, PortfolioResponse } from "@/lib/api/types";

export interface PortfolioHealthStripProps {
  portfolio: PortfolioResponse | undefined;
  analytics: PortfolioAnalyticsResponse | undefined;
  companies: CompanyGridItem[];
  loading?: boolean;
}

/**
 * Answers "where is my risk?" using only real or purely-derived figures. Sharpe ratio and max
 * drawdown are omitted entirely — both require a daily NAV time series that doesn't exist anywhere
 * in this backend, and there's no honest way to approximate them from a single current snapshot.
 * "Weighted Volatility" and "Sector Concentration" are real derivations (see lib/portfolio/
 * holdingsMath.ts) that gracefully disappear (via `omitIfNull`) when there isn't enough real data
 * to compute them, rather than showing a fabricated number.
 */
export function PortfolioHealthStrip({ portfolio, analytics, companies, loading }: PortfolioHealthStripProps) {
  const totalValue = portfolio ? Number(portfolio.total_value) : 0;
  const holdings = portfolio?.holdings ?? [];
  const weighted = withWeights(holdings, totalValue);
  const volatilityByTicker = new Map(
    companies.filter((c) => c.volatility != null).map((c) => [c.ticker, Number(c.volatility)])
  );
  const volatility = weightedVolatility(weighted, volatilityByTicker);
  const concentration = singleNameConcentrationPct(holdings, totalValue);
  const hhi = analytics ? sectorHHI(analytics.allocation_by_sector) : null;

  const items: MetricStripItem[] = [
    { key: "exposure", label: "Equity Exposure", value: analytics ? 100 - analytics.cash_allocation_pct : null, format: "pct" },
    { key: "cash", label: "Cash", value: analytics?.cash_allocation_pct ?? null, format: "pct" },
    { key: "positions", label: "Positions", value: analytics?.num_positions ?? null, format: "number" },
    { key: "winrate", label: "Win Rate", value: analytics?.win_rate != null ? analytics.win_rate * 100 : null, format: "pct" },
    {
      key: "concentration",
      label: "Largest Position",
      value: concentration,
      format: "pct",
      hint: "Share of total portfolio value held in your single largest position.",
    },
    {
      key: "sector-conc",
      label: "Sector Concentration",
      value: null,
      textValue: hhi != null ? hhiLabel(hhi) : undefined,
      hint: "Herfindahl-Hirschman Index over sector allocation, bucketed Low / Moderate / High.",
      omitIfNull: true,
    },
    {
      key: "volatility",
      label: "Weighted Volatility",
      value: volatility,
      format: "pct",
      hint: "Weighted average of each holding's company-level volatility — a proxy, not a statistical portfolio volatility (no daily NAV history exists to compute one).",
      omitIfNull: true,
    },
  ];

  return (
    <DashboardPanel eyebrow="Health" title="Portfolio Health" icon={Activity} noBodyPadding>
      <MetricStrip items={items} loading={loading} />
    </DashboardPanel>
  );
}
