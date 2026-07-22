"use client";

import * as React from "react";
import { Building2, Search } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { CompanyReviewCard } from "@/components/ai/CompanyReviewCard";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { cn, formatPrice, formatPct } from "@/lib/utils";

/** Company Review, embedded directly in the AI Workspace -- a real ticker
 * search + inline result, not a link out to the Company page. The launcher
 * tile used to just navigate away; this makes "Company Analysis" an
 * actual in-page capability like the other five. */
export function CompanyReviewWorkspacePanel({ onGenerated }: { onGenerated?: () => void }) {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const market = useMarketGrid();

  const matches = React.useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toUpperCase();
    return (market.data?.companies ?? [])
      .filter((c) => c.ticker.toUpperCase().includes(q) || c.name.toUpperCase().includes(q))
      .slice(0, 8);
  }, [query, market.data]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <DashboardPanel eyebrow="Pick a Company" title="Search" icon={Search} className="lg:col-span-4">
        <div className="flex flex-col gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ticker or company name..."
            autoFocus
          />
          <div className="flex flex-col gap-1">
            {matches.map((c) => (
              <button
                key={c.ticker}
                type="button"
                onClick={() => {
                  setSelected(c.ticker);
                  setQuery("");
                }}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-mer-sm px-2.5 py-2 text-left hover:bg-mer-surface-3",
                  selected === c.ticker && "bg-mer-surface-3"
                )}
              >
                <span className="min-w-0">
                  <span className="num mr-1.5 text-small font-medium text-mer-ink-primary">{c.ticker}</span>
                  <span className="truncate text-micro text-mer-ink-tertiary">{c.name}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num block text-micro text-mer-ink-primary">{formatPrice(c.current_price)}</span>
                  {c.day_change_pct != null && (
                    <span className={cn("num block text-micro", c.day_change_pct >= 0 ? "text-positive" : "text-negative")}>
                      {formatPct(c.day_change_pct)}
                    </span>
                  )}
                </span>
              </button>
            ))}
            {query.trim() && matches.length === 0 && (
              <p className="px-2.5 py-2 text-micro text-mer-ink-tertiary">No companies match &quot;{query}&quot;.</p>
            )}
          </div>
          {!query.trim() && (
            <p className="px-2.5 py-2 text-micro text-mer-ink-tertiary">
              Start typing to search {market.data?.companies.length ?? "…"} companies.
            </p>
          )}
        </div>
      </DashboardPanel>

      <div className="lg:col-span-8">
        {selected ? (
          <CompanyReviewCard ticker={selected} onGenerated={onGenerated} />
        ) : (
          <DashboardPanel eyebrow="✦ AI COMPANY ANALYSIS" title="AI Analysis" icon={Building2} edge="iris">
            <EmptyState icon={Building2} title="Search for a company" description="Pick a ticker on the left to pull up its AI analysis." />
          </DashboardPanel>
        )}
      </div>
    </div>
  );
}
