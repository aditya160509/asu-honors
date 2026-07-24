"use client";

import * as React from "react";
import { useRef, useEffect } from "react";
import { Building2, Search } from "lucide-react";
import gsap from "gsap";
import { EASE_OUT_EXPO } from "@/lib/motion/tokens";
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
  const resultsRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const matches = React.useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toUpperCase();
    return (market.data?.companies ?? [])
      .filter((c) => c.ticker.toUpperCase().includes(q) || c.name.toUpperCase().includes(q))
      .slice(0, 8);
  }, [query, market.data]);

  // Staggered entry for search results
  useEffect(() => {
    if (!resultsRef.current) return;
    const items = resultsRef.current.querySelectorAll<HTMLElement>("[data-result-item]");
    if (items.length === 0) return;
    gsap.fromTo(
      items,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, stagger: 0.035, duration: 0.3, ease: EASE_OUT_EXPO }
    );
  }, [matches]);

  // Fade in right panel content on selection change
  useEffect(() => {
    if (!rightPanelRef.current) return;
    gsap.fromTo(
      rightPanelRef.current,
      { opacity: 0, x: 6 },
      { opacity: 1, x: 0, duration: 0.3, ease: EASE_OUT_EXPO }
    );
  }, [selected]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <DashboardPanel eyebrow="Pick a Company" title="Search" icon={Search} className="lg:col-span-4">
        <div className="flex flex-col gap-2">
          <Input
            className="transition-all duration-150"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ticker or company name..."
            autoFocus
          />
          <div ref={resultsRef} className="flex flex-col gap-0.5">
            {matches.map((c) => (
              <button
                data-result-item
                key={c.ticker}
                type="button"
                onClick={() => {
                  setSelected(c.ticker);
                  setQuery("");
                }}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-mer-sm px-2.5 py-2 text-left transition-all duration-150 hover:bg-mer-surface-3 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mer-accent-500)]/40",
                  selected === c.ticker && "bg-mer-surface-3"
                )}
              >
                <span className="min-w-0">
                  <span className="num mr-1.5 text-small font-semibold tracking-wide text-mer-ink-primary">{c.ticker}</span>
                  <span className="truncate text-micro text-mer-ink-tertiary">{c.name}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num block text-small text-mer-ink-primary">{formatPrice(c.current_price)}</span>
                  {c.day_change_pct != null && (
                    <span className={cn("num block text-small", c.day_change_pct >= 0 ? "text-positive" : "text-negative")}>
                      {formatPct(c.day_change_pct)}
                    </span>
                  )}
                </span>
              </button>
            ))}
            {query.trim() && matches.length === 0 && (
              <p className="px-2.5 py-3 text-center text-micro text-mer-ink-tertiary">
                No companies match &quot;{query}&quot;.
              </p>
            )}
          </div>
          {!query.trim() && (
            <div className="flex flex-col items-center gap-1 px-2.5 py-6">
              <Search size={16} className="text-mer-ink-tertiary/50" />
              <p className="text-center text-micro text-mer-ink-tertiary">
                Type to search {market.data?.companies.length ?? "—"} companies
              </p>
            </div>
          )}
        </div>
      </DashboardPanel>

      <div ref={rightPanelRef} className="lg:col-span-8">
        {selected ? (
          <CompanyReviewCard ticker={selected} onGenerated={onGenerated} />
        ) : (
          <DashboardPanel eyebrow="✦ AI COMPANY ANALYSIS" title="AI Analysis" icon={Building2} edge="iris">
            <EmptyState
              icon={Building2}
              title="Search for a company"
              description="Pick a ticker on the left to pull up its AI analysis."
            />
          </DashboardPanel>
        )}
      </div>
    </div>
  );
}
