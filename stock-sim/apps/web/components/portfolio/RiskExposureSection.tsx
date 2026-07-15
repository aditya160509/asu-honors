"use client";

import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { CompanyRow } from "@/components/dashboard/primitives/CompanyRow";
import { largestPositions, topLosers, topWinners, withWeights } from "@/lib/portfolio/holdingsMath";
import type { HoldingResponse } from "@/lib/api/types";

export interface RiskExposureSectionProps {
  holdings: HoldingResponse[];
  totalValue: number;
  loading?: boolean;
}

interface RankedHolding {
  ticker: string;
  company_name: string;
  current_price: number;
  unrealized_pnl_pct: number;
}

function HoldingList({ title, items, empty }: { title: string; items: RankedHolding[]; empty: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-2 text-micro uppercase text-mer-ink-tertiary">{title}</span>
      {items.length === 0 ? (
        <p className="px-2 py-2 text-small text-mer-ink-tertiary">{empty}</p>
      ) : (
        items.map((h) => (
          <CompanyRow
            key={h.ticker}
            ticker={h.ticker}
            name={h.company_name}
            price={Number(h.current_price)}
            changePct={Number(h.unrealized_pnl_pct)}
          />
        ))
      )}
    </div>
  );
}

/**
 * Answers "where is my risk?" and "where are my opportunities?" from real holdings data only —
 * largest positions by weight (concentration), and biggest open winners/losers by unrealized P&L%.
 * Deliberately doesn't repeat the sector-level breakdown already shown in Allocation Studio.
 */
export function RiskExposureSection({ holdings, totalValue, loading }: RiskExposureSectionProps) {
  const weighted = withWeights(holdings, totalValue);
  const largest = largestPositions(weighted, 4);
  const winners = topWinners(holdings, 4);
  const losers = topLosers(holdings, 4);

  return (
    <DashboardPanel eyebrow="Concentration" title="Risk & Exposure" icon={AlertTriangle} noBodyPadding>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 p-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton width={100} height={12} />
              <Skeleton width="100%" height={40} />
              <Skeleton width="100%" height={40} />
            </div>
          ))}
        </div>
      ) : holdings.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No open positions yet." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-3 lg:grid-cols-3">
          <HoldingList title="Largest Positions" items={largest} empty="—" />
          <HoldingList title="Top Winners" items={winners} empty="No open gains yet." />
          <HoldingList title="Top Losers" items={losers} empty="No open losses yet." />
        </div>
      )}
    </DashboardPanel>
  );
}
