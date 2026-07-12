"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CycleIndicator } from "@/components/simulation/CycleIndicator";
import { formatDateFull } from "@/lib/utils";
import { useAdvance, useSimState } from "@/lib/api/hooks/useSimulation";
import { useCycleState } from "@/lib/api/hooks/useMarket";

const ADVANCE_OPTIONS = [1, 5, 30] as const;

export function AdvanceControls() {
  const simState = useSimState();
  const cycle = useCycleState();
  const advance = useAdvance();

  if (simState.isLoading) return <Skeleton width="100%" height={80} />;
  if (simState.isError) {
    return <EmptyState title="Select or create a timeline first." description="No active simulation state was found." />;
  }
  if (!simState.data) return null;

  return (
    <div className="card-flat p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="num text-h2 font-bold text-text-primary">{formatDateFull(simState.data.current_sim_date)}</p>
          <p className="num text-small text-text-secondary">Tick #{simState.data.tick_count}</p>
        </div>
        {cycle.data && <CycleIndicator phase={cycle.data.cycle_phase} />}
      </div>

      {advance.isError && (
        <p className="text-small text-negative">Advance failed: {(advance.error as Error)?.message ?? "unknown error"}</p>
      )}

      <div className="flex gap-2">
        {ADVANCE_OPTIONS.map((days) => (
          <Button
            key={days}
            variant="outline"
            disabled={advance.isPending}
            onClick={() => advance.mutate({ timeline_id: simState.data!.timeline_id, days })}
          >
            {advance.isPending ? "Advancing…" : `${days} Day${days > 1 ? "s" : ""}`}
          </Button>
        ))}
      </div>
    </div>
  );
}
