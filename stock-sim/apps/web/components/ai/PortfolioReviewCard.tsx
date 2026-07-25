"use client";

import { AiGroundedCard } from "@/components/ai/AiGroundedCard";
import { usePortfolioReview } from "@/lib/api/hooks/useAi";
import { usePortfolioAnalytics } from "@/lib/api/hooks/usePortfolio";
import { cn } from "@/lib/utils";

const SECTOR_BAR_COLORS = ["bg-mer-accent-500", "bg-[#8b7cf6]", "bg-positive", "bg-warning", "bg-mer-ink-tertiary"];

function SectorAllocationMiniViz() {
  const analytics = usePortfolioAnalytics();
  const sectors = (analytics.data?.allocation_by_sector ?? [])
    .slice()
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);
  if (sectors.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-mer-sm border border-[color:var(--mer-stroke-hairline)] bg-mer-surface-1 p-2.5 transition-all duration-fast ease-out-expo hover:border-[color:var(--mer-stroke-emphasis)]">
      <span className="text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">Sector Allocation</span>
      {sectors.map((s, i) => (
        <div key={s.sector} className="flex items-center gap-2 rounded-mer-xs -mx-1 px-1 py-0.5 transition-colors duration-fast ease-out-expo hover:bg-mer-surface-2">
          <span className="w-28 shrink-0 truncate text-micro text-mer-ink-secondary">{s.sector}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mer-surface-3">
            <div
              className={cn("h-full rounded-full transition-[width] duration-700 ease-out-expo", SECTOR_BAR_COLORS[i % SECTOR_BAR_COLORS.length])}
              style={{ width: `${Math.min(100, s.pct)}%` }}
            />
          </div>
          <span className="num w-12 shrink-0 text-right text-micro text-mer-ink-tertiary">{s.pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export function PortfolioReviewCard({ className, onGenerated }: { className?: string; onGenerated?: () => void }) {
  const review = usePortfolioReview();

  return (
    <AiGroundedCard
      badgeLabel="AI PORTFOLIO REVIEW"
      title="Portfolio Review"
      actionLabel="Generate Review"
      data={review.data}
      isPending={review.isPending}
      isError={review.isError}
      error={review.error}
      generatedAt={review.generatedAt}
      onGenerate={() => {
        review.generate().then((result) => {
          if (result.data) onGenerated?.();
        });
      }}
      className={className}
    >
      <SectorAllocationMiniViz />
    </AiGroundedCard>
  );
}
