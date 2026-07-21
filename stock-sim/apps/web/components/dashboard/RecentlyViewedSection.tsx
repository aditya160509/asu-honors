"use client";

import { History } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useRecentlyViewed } from "@/lib/companies/useRecentlyViewed";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { CompanyRow } from "@/components/dashboard/primitives/CompanyRow";

/** Companies visited this browser (lib/companies/useRecentlyViewed), most
 * recent first. Price/change are intentionally omitted (null) -- showing a
 * stale price from whenever the company was last viewed would misrepresent
 * it as current; CompanyRow already renders "N/A" cleanly for that case. */
export function RecentlyViewedSection() {
  const entries = useRecentlyViewed();

  return (
    <DashboardPanel
      eyebrow="History"
      title="Recently Viewed"
      icon={History}
      className="col-span-full md:col-span-6 lg:col-span-4"
      noBodyPadding
    >
      <div className="flex flex-col gap-0.5 p-2">
        {entries.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nothing here yet."
            description="Companies you visit will show up here."
          />
        ) : (
          entries.map((e) => (
            <CompanyRow key={e.ticker} ticker={e.ticker} name={e.name} price={null} changePct={null} />
          ))
        )}
      </div>
    </DashboardPanel>
  );
}
