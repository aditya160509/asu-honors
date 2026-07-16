"use client";

import * as React from "react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderForm } from "@/components/trading/OrderForm";
import { OrdersPanel } from "@/components/trading/OrdersPanel";
import { PnlCard } from "@/components/portfolio/AnalyticsMetricsPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePortfolio, usePortfolioAnalytics } from "@/lib/api/hooks/usePortfolio";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";

/** Phase 3 — Trading Desk: order ticket (market/limit, read-back confirm),
 * order lifecycle (open/filled/cancelled), and portfolio-level P&L. */
export default function TradingDeskPage() {
  const market = useMarketGrid();
  const portfolio = usePortfolio();
  const analytics = usePortfolioAnalytics();
  const [ticker, setTicker] = React.useState<string | null>(null);

  const companies = React.useMemo(
    () => [...(market.data?.companies ?? [])].sort((a, b) => a.ticker.localeCompare(b.ticker)),
    [market.data]
  );

  React.useEffect(() => {
    if (!ticker && companies.length > 0) setTicker(companies[0].ticker);
  }, [ticker, companies]);

  const selectedCompany = companies.find((c) => c.ticker === ticker);
  const holding = portfolio.data?.holdings.find((h) => h.ticker === ticker);

  return (
    <TerminalShell>
      <PageHeader title="Trading Desk" description="Place market and limit orders, track open orders and fills." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <OrdersPanel />
          <PnlCard
            loading={analytics.isLoading}
            realized={Number(analytics.data?.realized_pnl ?? 0)}
            unrealized={Number(analytics.data?.unrealized_pnl ?? 0)}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Select value={ticker ?? ""} onValueChange={setTicker}>
            <SelectTrigger>
              <SelectValue placeholder="Select a ticker" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.ticker} value={c.ticker}>
                  {c.ticker} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {ticker && selectedCompany && (
            <OrderForm
              ticker={ticker}
              currentPrice={selectedCompany.current_price != null ? Number(selectedCompany.current_price) : null}
              cashBalance={portfolio.data ? Number(portfolio.data.cash_balance) : 0}
              sharesHeld={holding?.quantity ?? 0}
              isPortfolioLoading={portfolio.isLoading}
              onOrderPlaced={() => {
                portfolio.refetch();
                analytics.refetch();
              }}
            />
          )}
        </div>
      </div>
    </TerminalShell>
  );
}
