"use client";

import * as React from "react";
import { Activity } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
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
  accent?: "positive" | "negative" | "blue";
}

const METRICS: MetricDef[] = [
  {
    key: "beta",
    label: "Beta",
    definition: "Sensitivity of your portfolio's daily returns to the market composite.",
    formula: "β = Cov(rp, rm) / Var(rm)",
    format: (v) => v.toFixed(2),
    accent: "blue",
  },
  {
    key: "sharpe_ratio",
    label: "Sharpe Ratio",
    definition: "Return earned per unit of risk taken (risk-free rate 0 in this sim).",
    formula: "Sharpe = mean(r) / σ(r) × √252",
    format: (v) => v.toFixed(2),
    accent: "positive",
  },
  {
    key: "volatility_pct",
    label: "Volatility",
    definition: "Annualized standard deviation of daily portfolio returns.",
    formula: "σannual = σdaily × √252",
    format: (v) => `${v.toFixed(1)}%`,
    accent: "negative",
  },
  {
    key: "max_drawdown_pct",
    label: "Max Drawdown",
    definition: "Largest peak-to-trough decline of portfolio value.",
    formula: "MDD = min(value / peak − 1)",
    format: (v) => `${v.toFixed(1)}%`,
    accent: "negative",
  },
  {
    key: "win_rate",
    label: "Win Rate",
    definition: "Share of closed positions that realized a profit.",
    formula: "wins / closed trades × 100",
    format: (v) => `${v.toFixed(0)}%`,
    accent: "positive",
  },
];

const ACCENT_COLORS = {
  positive: { color: "var(--positive)", glow: "rgba(34, 197, 94, 0.12)", border: "rgba(34, 197, 94, 0.18)" },
  negative: { color: "var(--negative)", glow: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.18)" },
  blue: { color: "var(--accent)", glow: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.18)" },
};

function MetricCard({ metric, value, loading }: { metric: MetricDef; value: number | null; loading: boolean }) {
  const accent = metric.accent ? ACCENT_COLORS[metric.accent] : ACCENT_COLORS.blue;

  return (
    <div
      className="relative flex flex-col gap-2.5 overflow-hidden rounded-mer-md p-4 transition-all duration-200"
      style={{
        background: `linear-gradient(135deg, var(--mer-surface-2) 0%, var(--mer-surface-3) 100%)`,
        border: `1px solid ${accent.border}`,
        boxShadow: `0 0 0 0px ${accent.glow}, var(--mer-shadow-rest)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 20px ${accent.glow}, var(--mer-shadow-raised)`;
        e.currentTarget.style.borderColor = accent.color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 0px ${accent.glow}, var(--mer-shadow-rest)`;
        e.currentTarget.style.borderColor = accent.border;
      }}
    >
      <span
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accent.color} 50%, transparent 100%)`,
          opacity: 0.4,
        }}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="w-fit cursor-help border-b border-dotted text-micro font-medium uppercase tracking-wide"
            style={{
              color: "var(--mer-ink-tertiary)",
              borderColor: "var(--mer-stroke-emphasis)",
              letterSpacing: "0.08em",
            }}
          >
            {metric.label}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px]">
          <p className="text-small">{metric.definition}</p>
          <p className="num mt-1 text-micro text-mer-ink-tertiary" style={{ fontFamily: "var(--font-mono)" }}>{metric.formula}</p>
        </TooltipContent>
      </Tooltip>

      {loading ? (
        <Skeleton width={72} height={32} />
      ) : value == null ? (
        <>
          <span
            className="num font-medium leading-8 text-mer-ink-tertiary"
            style={{ fontSize: "1.75rem" }}
          >
            —
          </span>
          <span className="text-micro text-mer-ink-tertiary">Needs more trading history</span>
        </>
      ) : (
        <span
          className="num font-medium leading-8"
          style={{
            fontSize: "1.75rem",
            fontFamily: "var(--font-mono)",
            color: accent.color,
            textShadow: `0 0 20px ${accent.glow}`,
          }}
        >
          {metric.format(value)}
        </span>
      )}
    </div>
  );
}

function PnlBar({ label, value, max }: { label: string; value: number; max: number }) {
  const positive = value >= 0;
  const widthPct = max > 0 ? Math.min((Math.abs(value) / max) * 50, 50) : 0;
  const barColor = positive ? "var(--positive)" : "var(--negative)";
  const barGlow = positive ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span
          className="text-micro uppercase tracking-wide"
          style={{ color: "var(--mer-ink-tertiary)", letterSpacing: "0.06em" }}
        >
          {label}
        </span>
        <span
          className="num text-body font-medium"
          style={{
            color: positive ? "var(--positive)" : "var(--negative)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {positive ? "▲ +" : "▼ −"}
          {formatPrice(Math.abs(value))}
        </span>
      </div>
      <div
        className="relative h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--mer-surface-3)" }}
      >
        <span
          className="absolute inset-y-0 left-1/2 w-px"
          style={{ backgroundColor: "var(--mer-stroke-emphasis)" }}
        />
        <span
          className="absolute inset-y-0 rounded-full"
          style={{
            backgroundColor: barColor,
            boxShadow: `0 0 8px ${barGlow}`,
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {METRICS.map((m) => {
          const raw = data?.[m.key];
          const value = raw == null ? null : Number(raw);
          return <MetricCard key={m.key} metric={m} value={value} loading={analytics.isLoading} />;
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
