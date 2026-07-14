"use client";

import * as React from "react";
import gsap from "gsap";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { MarketExplorer } from "@/components/market/MarketExplorer";
import { CycleIndicator } from "@/components/simulation/CycleIndicator";
import { useMarketGrid, useCycleState } from "@/lib/api/hooks/useMarket";

export default function MarketPage() {
  const { data, isLoading, isError, refetch } = useMarketGrid();
  const { data: cycle } = useCycleState();
  const ledgerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (ledgerRef.current) {
      gsap.fromTo(ledgerRef.current, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.inOut" });
    }
  }, []);

  return (
    <TerminalShell>
      <div className="mb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-micro font-medium uppercase tracking-wide text-text-tertiary">Market Explorer</span>
            <h1 className="text-h2 font-semibold text-text-primary">Screener</h1>
            <p className="text-small text-text-secondary">
              {data ? `${data.companies.length} companies across the simulated market — live pricing.` : "Live simulated pricing."}
            </p>
          </div>
          {cycle && <CycleIndicator phase={cycle.cycle_phase} tooltip={`Sim date: ${cycle.sim_date}`} />}
        </div>
        <div
          ref={ledgerRef}
          className="mt-2 h-px w-full origin-left bg-gradient-to-r from-transparent via-accent to-transparent opacity-70"
        />
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
