"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { CompanyHeader } from "@/components/companies/CompanyHeader";
import { PriceChart } from "@/components/charts/PriceChart";
import { DriverChart } from "@/components/charts/DriverChart";
import { ValuationCard } from "@/components/companies/ValuationCard";
import { FinancialTabs } from "@/components/companies/FinancialTabs";
import { OrderForm } from "@/components/trading/OrderForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany, useDrivers, useFinancials, usePriceHistory, useValuation } from "@/lib/api/hooks/useCompany";
import { usePortfolio } from "@/lib/api/hooks/usePortfolio";
import { ApiError } from "@/lib/api/client";

export default function CompanyDetailPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = (params.ticker ?? "").toUpperCase();
  const router = useRouter();

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
        <div className="text-center mt-2">
          <Link href="/market" className="text-small text-text-link">
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
  const dayChangePct =
    history.data && history.data.length >= 2
      ? ((Number(history.data[history.data.length - 1].close) - Number(history.data[history.data.length - 2].close)) /
          Number(history.data[history.data.length - 2].close)) *
        100
      : null;

  return (
    <TerminalShell>
      {company.isLoading || !company.data ? (
        <Skeleton height={48} className="w-full mb-4" />
      ) : (
        <CompanyHeader company={company.data} dayChangePct={dayChangePct} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Price</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceChart
                data={history.data ?? []}
                loading={history.isLoading}
                error={history.isError}
                onRetry={() => history.refetch()}
                ticker={ticker}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Price Drivers</CardTitle>
            </CardHeader>
            <CardContent>
              {drivers.isLoading ? (
                <Skeleton height={140} className="w-full" />
              ) : (
                <DriverChart drivers={drivers.data ?? []} />
              )}
            </CardContent>
          </Card>

          <FinancialTabs financials={financials.data} loading={financials.isLoading} />
        </div>

        <div className="flex flex-col gap-4">
          <ValuationCard valuation={valuation.data} loading={valuation.isLoading} />
          <OrderForm
            ticker={ticker}
            currentPrice={currentPrice}
            cashBalance={portfolio.data ? Number(portfolio.data.cash_balance) : 0}
            sharesHeld={holding?.quantity ?? 0}
            onOrderPlaced={() => {
              company.refetch();
              portfolio.refetch();
            }}
          />
        </div>
      </div>
    </TerminalShell>
  );
}
