import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { ValuationResponse } from "@/lib/api/types";

export interface ValuationCardProps {
  valuation: ValuationResponse | undefined;
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
        <span className="text-text-secondary">{label}</span>
        <span className="num text-text-primary">{num.toFixed(0)}</span>
      </div>
      <div className="h-1 bg-bg-tertiary rounded-full overflow-hidden">
        <div className={cn("h-full", scoreColor(num))} style={{ width: `${Math.min(100, Math.max(0, num))}%` }} />
      </div>
    </div>
  );
}

export function ValuationCard({ valuation, loading }: ValuationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Valuation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
              <span className="text-text-secondary">Intrinsic Score</span>
              <span className="num text-text-primary font-semibold">{Number(valuation.intrinsic_score).toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between text-small">
              <span className="text-text-secondary">Fair P/E</span>
              <span className="num text-text-primary">{Number(valuation.fair_pe).toFixed(2)}</span>
            </div>
            <ScoreBar label="Moat Score" value={valuation.moat_score} />
            <ScoreBar label="Management Quality" value={valuation.management_quality} />
            <ScoreBar label="FCF Quality" value={valuation.fcf_quality} />
            <ScoreBar label="Growth Potential" value={valuation.growth_potential} />
            <ScoreBar label="Financial Quality" value={valuation.financial_quality} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
