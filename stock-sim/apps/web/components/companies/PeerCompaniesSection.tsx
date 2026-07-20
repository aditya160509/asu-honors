"use client";

import * as React from "react";
import { Layers, Scale } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { sameIndustryCompanies } from "@/lib/companies/peers";
import { enrichCompanies } from "@/lib/market/filters";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { CompanyRow } from "@/components/dashboard/primitives/CompanyRow";
import { CompareDrawer } from "@/components/market/CompareDrawer";

export interface PeerCompaniesSectionProps {
  ticker: string;
  industryName: string;
}

/** "Same Industry" — a real, derived grouping from the live /market grid by shared industry_name.
 * There is no comparables/peer-group endpoint, so this is intentionally labeled as industry grouping,
 * not a curated peer or valuation-multiple comparison. The Compare button reuses the screener's own
 * CompareDrawer + enrichment step (ivGapPct etc.) rather than a second implementation. */
export function PeerCompaniesSection({ ticker, industryName }: PeerCompaniesSectionProps) {
  const { data, isLoading } = useMarketGrid();
  const rows = sameIndustryCompanies(data?.companies ?? [], industryName, ticker, 6);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [compareTickers, setCompareTickers] = React.useState<Set<string>>(new Set());

  const enriched = React.useMemo(() => enrichCompanies(data?.companies ?? []), [data?.companies]);

  function openCompare() {
    setCompareTickers(new Set([ticker, ...rows.map((r) => r.ticker)]));
    setCompareOpen(true);
  }

  return (
    <DashboardPanel
      eyebrow="Same Industry"
      title={industryName}
      icon={Layers}
      noBodyPadding
      actions={
        rows.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={openCompare} className="gap-1.5">
            <Scale size={13} />
            Compare
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-0.5 p-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width="100%" height={40} />)
        ) : rows.length === 0 ? (
          <EmptyState title="No other companies in this industry yet." />
        ) : (
          rows.map((c) => (
            <CompanyRow
              key={c.ticker}
              ticker={c.ticker}
              name={c.name}
              price={Number(c.current_price)}
              changePct={c.day_change_pct != null ? Number(c.day_change_pct) : null}
            />
          ))
        )}
      </div>

      <CompareDrawer
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        tickers={Array.from(compareTickers)}
        companies={enriched}
        onRemove={(t) => setCompareTickers((prev) => new Set([...prev].filter((x) => x !== t)))}
      />
    </DashboardPanel>
  );
}
