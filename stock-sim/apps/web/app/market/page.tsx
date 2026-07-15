"use client";

import * as React from "react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { MarketExplorer } from "@/components/market/MarketExplorer";
import { CycleIndicator } from "@/components/simulation/CycleIndicator";
import { useMarketGrid, useCycleState } from "@/lib/api/hooks/useMarket";

export default function MarketPage() {
  const { data, isLoading, isError, refetch } = useMarketGrid();
  const { data: cycle } = useCycleState();

  return (
    <TerminalShell>
      <div className="mb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-micro font-semibold uppercase tracking-wider text-text-tertiary">Market Explorer</span>
            <h1 className="text-h2 font-bold text-text-primary tracking-tight">Screener</h1>
            <p className="text-small text-text-secondary">
              {data ? (
                <span>
                  <span className="num font-medium text-text-primary">{data.companies.length}</span> companies —{" "}
                  <span className="text-text-tertiary">live simulated pricing</span>
                </span>
              ) : (
                "Live simulated pricing"
              )}
            </p>
          </div>
          {cycle && <CycleIndicator phase={cycle.cycle_phase} tooltip={`Sim date: ${cycle.sim_date}`} />}
        </div>
      </div>
      <MarketExplorer
        companies={data?.companies ?? []}
        loading={isLoading}
        error={isError}
        onRetry={() => refetch()}
      />
    </TerminalShell>
  );
}
