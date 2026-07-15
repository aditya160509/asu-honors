"use client";

import { Globe } from "lucide-react";
import { CycleIndicator } from "@/components/simulation/CycleIndicator";
import { useCycleState } from "@/lib/api/hooks/useMarket";
import { cn, formatDateFull } from "@/lib/utils";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { KpiCounter } from "@/components/dashboard/primitives/KpiCounter";

/**
 * This simulation models one market, not multiple exchanges — so "Global
 * Markets" is the macro cycle state (the closest real analog to a
 * cross-market snapshot the backend exposes), not fabricated international
 * indices.
 */
export function GlobalMarketsSection() {
  const { data: cycle, isLoading, isError, refetch } = useCycleState();

  return (
    <DashboardPanel eyebrow="Macro" title="Global Markets" icon={Globe} live className="col-span-full lg:col-span-6">
      {isError ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-small text-mer-ink-secondary">Couldn&apos;t load macro state.</p>
          <button onClick={() => refetch()} className="text-small text-mer-accent-300 hover:underline">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            {cycle ? <CycleIndicator phase={cycle.cycle_phase} /> : <span className="text-small text-mer-ink-tertiary">—</span>}
            <span className="num text-micro text-mer-ink-tertiary">{cycle ? formatDateFull(cycle.sim_date) : ""}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
            <KpiCounter
              label="Market Factor"
              value={cycle ? cycle.market_factor_return * 100 : 0}
              format="pct"
              tone="auto"
              loading={isLoading}
            />
            <KpiCounter label="GDP Growth" value={cycle?.gdp_growth ?? 0} format="pct" tone="auto" loading={isLoading} />
            <KpiCounter label="Interest Rate" value={cycle?.interest_rate ?? 0} format="pct" loading={isLoading} />
            <div className="flex flex-col gap-1.5">
              <span className="text-micro font-medium uppercase text-mer-ink-tertiary">Sentiment</span>
              {cycle && (
                <div className="flex flex-col gap-1">
                  <span
                    className={cn(
                      "num text-h3 font-semibold",
                      cycle.market_sentiment >= 0 ? "text-positive" : "text-negative"
                    )}
                  >
                    {cycle.market_sentiment >= 0 ? "+" : ""}
                    {cycle.market_sentiment.toFixed(2)}
                  </span>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-mer-surface-4">
                    <div
                      className={cn("h-full rounded-full", cycle.market_sentiment >= 0 ? "bg-positive" : "bg-negative")}
                      style={{
                        width: `${Math.min(Math.abs(cycle.market_sentiment) / 0.6, 1) * 100}%`,
                        marginLeft: cycle.market_sentiment < 0 ? "auto" : undefined,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardPanel>
  );
}
