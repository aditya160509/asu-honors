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
    <div className="group flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-small">
        <span className="text-mer-ink-secondary tracking-wide">{label}</span>
        <span className="num text-mer-ink-primary font-medium">{num.toFixed(0)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-mer-surface-4 ring-1 ring-inset ring-white/[0.04] transition-all duration-fast group-hover:ring-mer-accent-500/20">
        <div className={cn("h-full rounded-full transition-all duration-slow ease-out-expo", scoreColor(num))} style={{ width: `${Math.min(100, Math.max(0, num))}%` }} />
      </div>
    </div>
  );
}

export function ValuationCard({ valuation, eps, loading }: ValuationCardProps) {
  return (
    <DashboardPanel eyebrow="Fair Value Model" title="Valuation">
      <div className="flex flex-col gap-4">
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
            <div className="flex flex-col gap-2.5">
              <div className="group flex items-center justify-between rounded-mer-xs px-2 -mx-2 py-1 text-small transition-colors duration-fast hover:bg-mer-surface-3/50">
                <span className="text-mer-ink-secondary">Intrinsic Score</span>
                <span className="num text-base font-semibold text-mer-ink-primary">{Number(valuation.intrinsic_score).toFixed(1)}</span>
              </div>
              {eps != null && (
                <div className="group flex items-center justify-between rounded-mer-xs px-2 -mx-2 py-1 text-small transition-colors duration-fast hover:bg-mer-surface-3/50">
                  <span className="text-mer-ink-secondary">EPS (TTM)</span>
                  <span className="num text-mer-ink-primary">{formatPrice(eps)}</span>
                </div>
              )}
              <div className="group flex items-center justify-between rounded-mer-xs px-2 -mx-2 py-1 text-small transition-colors duration-fast hover:bg-mer-surface-3/50">
                <span className="text-mer-ink-secondary">Fair P/E</span>
                <span className="num text-mer-ink-primary">{Number(valuation.fair_pe).toFixed(2)}</span>
              </div>
              <div className="group flex items-center justify-between rounded-mer-xs px-2 -mx-2 py-1 text-small transition-colors duration-fast hover:bg-mer-surface-3/50">
                <span className="text-mer-ink-secondary">Intrinsic Value</span>
                <span className="num text-mer-ink-primary">{formatPrice(valuation.intrinsic_value)}</span>
              </div>
              </div>
            <div className="border-t border-mer-hairline" />
            <div className="flex flex-col gap-3">
              <ScoreBar label="Moat Score" value={valuation.moat_score} />
              <ScoreBar label="Management Quality" value={valuation.management_quality} />
              <ScoreBar label="FCF Quality" value={valuation.fcf_quality} />
              <ScoreBar label="Growth Potential" value={valuation.growth_potential} />
              <ScoreBar label="Financial Quality" value={valuation.financial_quality} />
            </div>
          </>
        )}
      </div>
    </DashboardPanel>
  );
}
