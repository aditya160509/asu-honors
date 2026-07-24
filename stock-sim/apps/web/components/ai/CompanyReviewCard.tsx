"use client";

import * as React from "react";
import { useRef, useEffect } from "react";
import gsap from "gsap";
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
  const vizRef = useRef<HTMLDivElement>(null);

  // Animate bar fills when valuation data arrives
  useEffect(() => {
    if (!valuation.data || !vizRef.current) return;
    const fills = vizRef.current.querySelectorAll<HTMLElement>("[data-bar-fill]");
    if (fills.length === 0) return;
    gsap.from(fills, {
      width: "0%",
      opacity: 0,
      duration: 0.5,
      stagger: 0.06,
      ease: "power3.out",
    });
  }, [valuation.data]);

  if (!valuation.data) return null;

  return (
    <div
      ref={vizRef}
      className="flex flex-col gap-1.5 rounded-mer-sm border border-[color:var(--mer-stroke-hairline)] bg-mer-surface-1 p-3 transition-all duration-200 hover:border-[color:var(--mer-stroke-emphasis)] hover:shadow-mer-raised"
    >
      <span className="text-micro font-semibold uppercase tracking-wider text-mer-ink-secondary">Factor Scores</span>
      {FACTOR_SCORES.map(({ key, label }) => {
        const score = valuation.data![key];
        return (
          <div
            key={key}
            className="flex items-center gap-2 rounded-mer-xs px-1 py-0.5 transition-colors duration-100 hover:bg-mer-surface-3/50"
          >
            <span className="w-28 shrink-0 truncate text-micro font-medium text-mer-ink-secondary">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mer-surface-3">
              <div
                data-bar-fill
                className={cn("h-full rounded-full transition-opacity duration-300", scoreColor(score))}
                style={{ width: `${Math.min(100, score)}%` }}
              />
            </div>
            <span className="num w-8 shrink-0 text-right text-micro font-medium text-mer-ink-tertiary">{score.toFixed(0)}</span>
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
