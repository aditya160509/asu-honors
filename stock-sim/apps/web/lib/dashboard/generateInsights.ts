import type { CycleStateResponse, PortfolioAnalyticsResponse, PortfolioResponse } from "@/lib/api/types";
import type { Insight } from "@/lib/dashboard/types";
import type { MarketOverviewStats } from "@/lib/dashboard/marketAggregates";
import { formatPct } from "@/lib/utils";

export interface GenerateInsightsInput {
  portfolio?: PortfolioResponse;
  analytics?: PortfolioAnalyticsResponse;
  cycle?: CycleStateResponse;
  marketStats?: MarketOverviewStats;
}

/**
 * Deterministic, rule-based signal generator — every sentence cites a real
 * number from an already-fetched query. There is no generative-AI backend in
 * this app, so nothing here is synthesized text; it's arithmetic over live
 * portfolio/market state, badged the same way a "smart insights" feature in
 * a real trading app would be.
 */
export function generateInsights({ portfolio, analytics, cycle, marketStats }: GenerateInsightsInput): Insight[] {
  const insights: Insight[] = [];

  if (portfolio?.day_change_pct != null && marketStats) {
    const delta = Number(portfolio.day_change_pct) - marketStats.avgChangePct;
    const outperforming = delta >= 0;
    insights.push({
      id: "vs-market",
      tone: outperforming ? "positive" : "negative",
      text: `Your portfolio is ${outperforming ? "outperforming" : "trailing"} the market average by ${formatPct(Math.abs(delta))} today (${formatPct(portfolio.day_change_pct)} vs ${formatPct(marketStats.avgChangePct)}).`,
      sourceLabel: "Portfolio vs. market breadth",
    });
  }

  if (portfolio?.holdings && portfolio.holdings.length > 0) {
    const best = [...portfolio.holdings].sort((a, b) => Number(b.unrealized_pnl_pct) - Number(a.unrealized_pnl_pct))[0];
    const worst = [...portfolio.holdings].sort((a, b) => Number(a.unrealized_pnl_pct) - Number(b.unrealized_pnl_pct))[0];

    if (best && Number(best.unrealized_pnl_pct) > 0) {
      insights.push({
        id: "best-holding",
        tone: "positive",
        text: `${best.ticker} is your best-performing position, up ${formatPct(best.unrealized_pnl_pct)} unrealized.`,
        sourceLabel: `${best.ticker} unrealized P&L`,
      });
    }
    if (worst && Number(worst.unrealized_pnl_pct) < 0) {
      insights.push({
        id: "worst-holding",
        tone: "negative",
        text: `${worst.ticker} is your weakest position, down ${formatPct(Math.abs(Number(worst.unrealized_pnl_pct)))} unrealized.`,
        sourceLabel: `${worst.ticker} unrealized P&L`,
      });
    }

    if (portfolio.total_value > 0) {
      const largest = [...portfolio.holdings].sort((a, b) => Number(b.market_value) - Number(a.market_value))[0];
      const concentrationPct = (Number(largest.market_value) / Number(portfolio.total_value)) * 100;
      if (concentrationPct >= 35) {
        insights.push({
          id: "concentration",
          tone: "warning",
          text: `${largest.ticker} makes up ${concentrationPct.toFixed(0)}% of your portfolio value — a concentrated position.`,
          sourceLabel: `${largest.ticker} allocation weight`,
        });
      }
    }
  }

  if (analytics?.win_rate != null) {
    insights.push({
      id: "win-rate",
      tone: analytics.win_rate >= 0.5 ? "positive" : "neutral",
      text: `${(analytics.win_rate * 100).toFixed(0)}% of your closed trades have been profitable across ${analytics.num_positions} position${analytics.num_positions === 1 ? "" : "s"}.`,
      sourceLabel: "Realized win rate",
    });
  }

  if (cycle) {
    const sentimentTone = cycle.market_sentiment > 0.1 ? "constructive" : cycle.market_sentiment < -0.1 ? "cautious" : "neutral";
    insights.push({
      id: "cycle",
      tone: cycle.market_sentiment > 0.1 ? "positive" : cycle.market_sentiment < -0.1 ? "warning" : "neutral",
      text: `The simulated economy is in its ${cycle.cycle_phase} phase with ${sentimentTone} sentiment (${cycle.market_sentiment >= 0 ? "+" : ""}${cycle.market_sentiment.toFixed(2)}).`,
      sourceLabel: "Economic cycle state",
    });
  }

  return insights;
}
