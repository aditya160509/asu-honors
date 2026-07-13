"use client";

import { TerminalShell } from "@/components/layout/TerminalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { MarketGrid } from "@/components/market/MarketGrid";
import { CycleIndicator } from "@/components/simulation/CycleIndicator";
import { useMarketGrid, useCycleState } from "@/lib/api/hooks/useMarket";

export default function MarketPage() {
  const { data, isLoading, isError, refetch } = useMarketGrid();
  const { data: cycle } = useCycleState();

  return (
    <TerminalShell>
      <PageHeader
        title="Market"
        description="150 companies across 15 industries — live simulated pricing."
        actions={cycle && <CycleIndicator phase={cycle.cycle_phase} tooltip={`Sim date: ${cycle.sim_date}`} />}
      />
      <MarketGrid
        companies={data?.companies ?? []}
        loading={isLoading}
        error={isError}
        onRetry={() => refetch()}
      />
    </TerminalShell>
  );
}
