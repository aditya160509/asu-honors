"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { cn, formatPrice } from "@/lib/utils";
import type { ValuationResponse } from "@/lib/api/types";

export interface ValuationCardProps {
  valuation: ValuationResponse | undefined;
  eps?: number | null;
  loading?: boolean;
}

function scoreColor(score: number): string {
  if (score < 34) return "bg-negative";
  if (score < 67) return "bg-warning";
  return "bg-positive";
}

function ScoreBar({ label, value }: { label: string; value: number | string }) {
  const num = Number(value);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-small">
        <span className="text-mer-ink-secondary">{label}</span>
        <span className="num text-mer-ink-primary">{num.toFixed(0)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-mer-surface-4">
        <div className={cn("h-full", scoreColor(num))} style={{ width: `${Math.min(100, Math.max(0, num))}%` }} />
      </div>
    </div>
  );
}

export function ValuationCard({ valuation, eps, loading }: ValuationCardProps) {
  return (
    <DashboardPanel eyebrow="Fair Value Model" title="Valuation">
      <div className="flex flex-col gap-3">
        {loading ? (
          <>
            <Skeleton width="100%" height={14} />
            <Skeleton width="100%" height={14} />
            <Skeleton width="100%" height={14} />
          </>
        ) : !valuation ? (
          <EmptyState title="Valuation data not available." />
        ) : (
          <>
            <div className="flex items-center justify-between text-small">
              <span className="text-mer-ink-secondary">Intrinsic Score</span>
              <span className="num font-semibold text-mer-ink-primary">{Number(valuation.intrinsic_score).toFixed(1)}</span>
            </div>
            {eps != null && (
              <div className="flex items-center justify-between text-small">
                <span className="text-mer-ink-secondary">EPS (TTM)</span>
                <span className="num text-mer-ink-primary">{formatPrice(eps)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-small">
              <span className="text-mer-ink-secondary">Fair P/E</span>
              <span className="num text-mer-ink-primary">{Number(valuation.fair_pe).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-small">
              <span className="text-mer-ink-secondary">Intrinsic Value</span>
              <span className="num text-mer-ink-primary">{formatPrice(valuation.intrinsic_value)}</span>
            </div>
            <ScoreBar label="Moat Score" value={valuation.moat_score} />
            <ScoreBar label="Management Quality" value={valuation.management_quality} />
            <ScoreBar label="FCF Quality" value={valuation.fcf_quality} />
            <ScoreBar label="Growth Potential" value={valuation.growth_potential} />
            <ScoreBar label="Financial Quality" value={valuation.financial_quality} />
          </>
        )}
      </div>
    </DashboardPanel>
  );
}
