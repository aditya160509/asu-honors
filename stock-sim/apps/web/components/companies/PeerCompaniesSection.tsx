"use client";

import { Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { sameIndustryCompanies } from "@/lib/companies/peers";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { CompanyRow } from "@/components/dashboard/primitives/CompanyRow";

export interface PeerCompaniesSectionProps {
  ticker: string;
  industryName: string;
}

/** "Same Industry" — a real, derived grouping from the live /market grid by shared industry_name.
 * There is no comparables/peer-group endpoint, so this is intentionally labeled as industry grouping,
 * not a curated peer or valuation-multiple comparison. */
export function PeerCompaniesSection({ ticker, industryName }: PeerCompaniesSectionProps) {
  const { data, isLoading } = useMarketGrid();
  const rows = sameIndustryCompanies(data?.companies ?? [], industryName, ticker, 6);

  return (
    <DashboardPanel eyebrow="Same Industry" title={industryName} icon={Layers} noBodyPadding>
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
    </DashboardPanel>
  );
}
