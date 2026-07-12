"use client";

import { TerminalShell } from "@/components/layout/TerminalShell";
import { MarketGrid } from "@/components/market/MarketGrid";
import { CycleIndicator } from "@/components/simulation/CycleIndicator";
import { useMarketGrid, useCycleState } from "@/lib/api/hooks/useMarket";

export default function MarketPage() {
  const { data, isLoading, isError, refetch } = useMarketGrid();
  const { data: cycle } = useCycleState();

  return (
    <TerminalShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-h2 font-semibold text-text-primary">Market</h1>
        {cycle && <CycleIndicator phase={cycle.cycle_phase} tooltip={`Sim date: ${cycle.sim_date}`} />}
      </div>
      <MarketGrid
        companies={data?.companies ?? []}
        loading={isLoading}
        error={isError}
        onRetry={() => refetch()}
      />
    </TerminalShell>
  );
}
