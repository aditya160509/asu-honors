"use client";

import * as React from "react";
import { Activity } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { usePortfolioAnalytics } from "@/lib/api/hooks/usePortfolio";
import { cn, formatPrice } from "@/lib/utils";

interface MetricDef {
  key: "beta" | "sharpe_ratio" | "volatility_pct" | "max_drawdown_pct" | "win_rate";
  label: string;
  definition: string;
  formula: string;
  format: (v: number) => string;
}

// Definition tooltips are a spec-level requirement for financial terminology
// (C5) — never ship jargon-labeled cards without an explainer.
const METRICS: MetricDef[] = [
  {
    key: "beta",
    label: "Beta",
    definition: "Sensitivity of your portfolio's daily returns to the market composite.",
    formula: "β = Cov(rp, rm) / Var(rm)",
    format: (v) => v.toFixed(2),
  },
  {
    key: "sharpe_ratio",
    label: "Sharpe Ratio",
    definition: "Return earned per unit of risk taken (risk-free rate 0 in this sim).",
    formula: "Sharpe = mean(r) / σ(r) × √252",
    format: (v) => v.toFixed(2),
  },
  {
    key: "volatility_pct",
    label: "Volatility",
    definition: "Annualized standard deviation of daily portfolio returns.",
    formula: "σannual = σdaily × √252",
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "max_drawdown_pct",
    label: "Max Drawdown",
    definition: "Largest peak-to-trough decline of portfolio value.",
    formula: "MDD = min(value / peak − 1)",
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "win_rate",
    label: "Win Rate",
    definition: "Share of closed positions that realized a profit.",
    formula: "wins / closed trades × 100",
    format: (v) => `${v.toFixed(0)}%`,
  },
];

/** C5 — Analytics: risk-metric card grid + the named P&L card pattern
 * (realized/unrealized split with a thin diverging bar centered on zero). */
export function AnalyticsMetricsPanel() {
  const analytics = usePortfolioAnalytics();

  if (analytics.isError) {
    return (
      <DashboardPanel eyebrow="Analytics" title="Risk & Return" icon={Activity}>
        <ErrorState message="Could not load analytics." onRetry={() => analytics.refetch()} />
      </DashboardPanel>
    );
  }

  const data = analytics.data;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {METRICS.map((m) => {
          const raw = data?.[m.key];
          const value = raw == null ? null : Number(raw);
          return (
            <div
              key={m.key}
              className={cn(
                "mer-surface-lit flex flex-col gap-2 rounded-mer-md border bg-mer-surface-2 p-4 shadow-mer-rest",
                MER_HAIRLINE
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-fit cursor-help border-b border-dotted border-[color:var(--mer-stroke-emphasis)] text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">
                    {m.label}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px]">
                  <p className="text-small">{m.definition}</p>
                  <p className="num mt-1 text-micro text-mer-ink-tertiary">{m.formula}</p>
                </TooltipContent>
              </Tooltip>
              {analytics.isLoading ? (
                <Skeleton width={72} height={30} />
              ) : value == null ? (
                <>
                  <span className="num text-[1.75rem] font-medium leading-8 text-mer-ink-tertiary">—</span>
                  <span className="text-micro text-mer-ink-tertiary">Needs more trading history</span>
                </>
              ) : (
                <span className="num text-[1.75rem] font-medium leading-8 text-mer-ink-primary">{m.format(value)}</span>
              )}
            </div>
          );
        })}
      </div>

      <PnlCard
        loading={analytics.isLoading}
        realized={Number(data?.realized_pnl ?? 0)}
        unrealized={Number(data?.unrealized_pnl ?? 0)}
      />
    </div>
  );
}

function PnlBar({ label, value, max }: { label: string; value: number; max: number }) {
  const positive = value >= 0;
  const widthPct = max > 0 ? Math.min((Math.abs(value) / max) * 50, 50) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-micro uppercase tracking-wide text-mer-ink-tertiary">{label}</span>
        <span className={cn("num text-body font-medium", positive ? "text-positive" : "text-negative")}>
          {positive ? "▲ +" : "▼ −"}
          {formatPrice(Math.abs(value))}
        </span>
      </div>
      {/* Thin diverging bar centered on zero — the P&L card's named pattern. */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-mer-surface-3">
        <span className="absolute inset-y-0 left-1/2 w-px bg-[color:var(--mer-stroke-emphasis)]" />
        <span
          className="absolute inset-y-0 rounded-full"
          style={{
            backgroundColor: positive ? "var(--positive)" : "var(--negative)",
            ...(positive ? { left: "50%" } : { right: "50%" }),
            width: `${widthPct}%`,
          }}
        />
      </div>
    </div>
  );
}

function PnlCard({ loading, realized, unrealized }: { loading: boolean; realized: number; unrealized: number }) {
  const max = Math.max(Math.abs(realized), Math.abs(unrealized), 1);
  return (
    <DashboardPanel eyebrow="Profit & Loss" title="Realized vs. Unrealized" icon={Activity}>
      {loading ? (
        <Skeleton height={80} className="w-full" />
      ) : (
        <div className="flex flex-col gap-5">
          <PnlBar label="Realized" value={realized} max={max} />
          <PnlBar label="Unrealized" value={unrealized} max={max} />
        </div>
      )}
    </DashboardPanel>
  );
}
