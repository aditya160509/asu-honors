"use client";

import { AiGroundedCard } from "@/components/ai/AiGroundedCard";
import { useCompanyReview } from "@/lib/api/hooks/useAi";
import { useValuation } from "@/lib/api/hooks/useCompany";
import { cn } from "@/lib/utils";

const FACTOR_SCORES: { key: "moat_score" | "financial_quality" | "growth_potential" | "management_quality"; label: string }[] = [
  { key: "moat_score", label: "Moat" },
  { key: "financial_quality", label: "Financial Quality" },
  { key: "growth_potential", label: "Growth Potential" },
  { key: "management_quality", label: "Management" },
];

function scoreColor(score: number): string {
  if (score >= 66) return "bg-positive";
  if (score >= 33) return "bg-warning";
  return "bg-negative";
}

function FactorScoreMiniViz({ ticker }: { ticker: string }) {
  const valuation = useValuation(ticker);
  if (!valuation.data) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-mer-sm border border-[color:var(--mer-stroke-hairline)] bg-mer-surface-1 p-2.5">
      <span className="text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">Factor Scores</span>
      {FACTOR_SCORES.map(({ key, label }) => {
        const score = valuation.data![key];
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate text-micro text-mer-ink-secondary">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mer-surface-3">
              <div className={cn("h-full rounded-full", scoreColor(score))} style={{ width: `${Math.min(100, score)}%` }} />
            </div>
            <span className="num w-10 shrink-0 text-right text-micro text-mer-ink-tertiary">{score.toFixed(0)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CompanyReviewCard({
  ticker,
  className,
  bare,
  onGenerated,
}: {
  ticker: string;
  className?: string;
  bare?: boolean;
  onGenerated?: () => void;
}) {
  // Keyed by ticker (see useAi.ts) -- switching tickers automatically shows
  // that ticker's own cached result (or none), no manual reset needed.
  const review = useCompanyReview(ticker);

  return (
    <AiGroundedCard
      badgeLabel="AI COMPANY ANALYSIS"
      title={`AI Analysis — ${ticker}`}
      actionLabel="Generate Analysis"
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
      bare={bare}
    >
      <FactorScoreMiniViz ticker={ticker} />
    </AiGroundedCard>
  );
}
