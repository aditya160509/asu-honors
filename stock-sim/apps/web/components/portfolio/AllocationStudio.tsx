"use client";

import * as React from "react";
import { PieChart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { RangeSelector } from "@/components/dashboard/primitives/RangeSelector";
import { AllocationTreemap } from "@/components/portfolio/AllocationTreemap";
import { AllocationBars } from "@/components/portfolio/AllocationBars";
import { AllocationChart } from "@/components/charts/AllocationChart";
import { allocationColor } from "@/lib/portfolio/allocationPalette";
import type { SectorAllocation } from "@/lib/api/types";

type View = "treemap" | "donut" | "bars";

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "treemap", label: "Treemap" },
  { value: "donut", label: "Donut" },
  { value: "bars", label: "Bars" },
];

export interface AllocationStudioProps {
  allocation: SectorAllocation[];
  loading?: boolean;
}

/**
 * Three views of the one allocation dimension this backend actually exposes — sector. Asset-class
 * and geographic allocation have no concept in the data model (companies have no asset-class or
 * country/region field), so per the "gracefully omit rather than fabricate" rule there's no toggle
 * for them at all, just an honest caption explaining the gap.
 */
export function AllocationStudio({ allocation, loading }: AllocationStudioProps) {
  const [view, setView] = React.useState<View>("treemap");
  const donutData = React.useMemo(
    () => allocation.map((s, i) => ({ label: s.sector, value: s.value, color: allocationColor(i) })),
    [allocation]
  );

  return (
    <DashboardPanel
      eyebrow="By Sector"
      title="Allocation Studio"
      icon={PieChart}
      noBodyPadding
      actions={<RangeSelector options={VIEW_OPTIONS} value={view} onChange={setView} />}
    >
      <p className="px-4 pt-3 text-micro text-mer-ink-tertiary">
        Sector breakdown of holdings. Asset-class and geographic breakdowns aren&apos;t tracked in this
        simulation&apos;s data model.
      </p>
      {loading ? (
        <div className="p-4">
          <Skeleton width="100%" height={200} />
        </div>
      ) : view === "treemap" ? (
        <AllocationTreemap allocation={allocation} />
      ) : view === "bars" ? (
        <AllocationBars allocation={allocation} />
      ) : (
        <div className="p-4">
          <AllocationChart data={donutData} />
        </div>
      )}
    </DashboardPanel>
  );
}
