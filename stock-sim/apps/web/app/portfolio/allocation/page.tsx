"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PieChart } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { RangeSelector } from "@/components/dashboard/primitives/RangeSelector";
import { AllocationStudio } from "@/components/portfolio/AllocationStudio";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolio, usePortfolioAnalytics } from "@/lib/api/hooks/usePortfolio";
import { formatLarge, formatPct } from "@/lib/utils";

type View = "sector" | "asset";

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "sector", label: "By Sector" },
  { value: "asset", label: "By Asset Class" },
];

// Categorical ramp positions 1 & 2 (cobalt, slate) — never arbitrary hues (A2).
const EQUITIES_COLOR = "#3e6fe0";
const CASH_COLOR = "#4e8fb8";

/** C4 — Allocation: sector treemap (AllocationStudio, reused) + an asset-class
 * split view. The Portfolio model tracks equities and cash only, so asset
 * class is a two-segment composition, not a fabricated multi-class chart. */
export default function AllocationPage() {
  const router = useRouter();
  const [view, setView] = React.useState<View>("sector");
  const portfolio = usePortfolio();
  const analytics = usePortfolioAnalytics();

  const allocation = analytics.data?.allocation_by_sector ?? [];
  const isEmpty = !portfolio.isLoading && (portfolio.data?.holdings.length ?? 0) === 0;

  if (isEmpty) {
    return (
      <DashboardPanel eyebrow="Allocation" title="Nothing to allocate yet" icon={PieChart}>
        <EmptyState
          title="Nothing to allocate yet"
          description="Your sector and asset mix will appear here once you hold positions."
          action={{ label: "Explore the market", onClick: () => router.push("/market") }}
        />
      </DashboardPanel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <RangeSelector options={VIEW_OPTIONS} value={view} onChange={setView} />
      </div>

      {view === "sector" ? (
        <AllocationStudio allocation={allocation} loading={analytics.isLoading} />
      ) : (
        <AssetClassPanel
          loading={analytics.isLoading}
          cashPct={analytics.data?.cash_allocation_pct ?? 0}
          cashValue={Number(analytics.data?.cash_balance ?? 0)}
          totalValue={Number(analytics.data?.total_value ?? 0)}
        />
      )}
    </div>
  );
}

function AssetClassPanel({
  loading,
  cashPct,
  cashValue,
  totalValue,
}: {
  loading: boolean;
  cashPct: number;
  cashValue: number;
  totalValue: number;
}) {
  const equitiesValue = totalValue - cashValue;
  const equitiesPct = 100 - cashPct;

  return (
    <DashboardPanel eyebrow="Allocation" title="Asset Classes" icon={PieChart} noBodyPadding>
      {loading ? (
        <div className="p-4">
          <Skeleton height={120} className="w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <div className="flex h-10 w-full overflow-hidden rounded-mer-xs" role="img" aria-label={`Equities ${formatPct(equitiesPct)}, cash ${formatPct(cashPct)}`}>
            <div style={{ width: `${Math.max(equitiesPct, 0)}%`, backgroundColor: EQUITIES_COLOR }} />
            <div style={{ width: `${Math.max(cashPct, 0)}%`, backgroundColor: CASH_COLOR }} />
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: EQUITIES_COLOR }} />
              <span className="text-small text-mer-ink-secondary">Equities</span>
              <span className="num text-small font-medium text-mer-ink-primary">{formatLarge(equitiesValue)}</span>
              <span className="num text-micro text-mer-ink-tertiary">{formatPct(equitiesPct)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CASH_COLOR }} />
              <span className="text-small text-mer-ink-secondary">Cash</span>
              <span className="num text-small font-medium text-mer-ink-primary">{formatLarge(cashValue)}</span>
              <span className="num text-micro text-mer-ink-tertiary">{formatPct(cashPct)}</span>
            </div>
          </div>
        </div>
      )}
    </DashboardPanel>
  );
}
