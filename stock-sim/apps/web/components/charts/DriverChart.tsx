"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { scoreToColor } from "@/lib/charts/series/BarSeries";
import { EmptyState } from "@/components/ui/empty-state";
import type { DriverBreakdown } from "@/lib/api/types";

const DRIVER_LABELS: Record<string, string> = {
  vo: "Value Opportunity",
  es: "Earnings Surprise",
  ns: "News Sentiment",
  eo: "Economic Outlook",
  g: "Guidance",
  tm: "Technical Momentum",
  ib: "Institutional Buying",
};

const DRIVER_DESCRIPTIONS: Record<string, string> = {
  vo: "Gap between market price and intrinsic value — mean-reversion pressure.",
  es: "Deviation of actual EPS from consensus estimate this quarter.",
  ns: "Aggregate sentiment of recent news events for this company.",
  eo: "How favorable the current economic cycle phase is for this industry.",
  g: "Management guidance revisions (raise/cut) since last earnings.",
  tm: "30-day price trend relative to its moving average.",
  ib: "Institutional buy/sell pressure, strongest on moderate dips, dampened in deep crashes.",
};

export interface DriverChartProps {
  drivers: DriverBreakdown[];
}

export function DriverChart({ drivers }: DriverChartProps) {
  if (drivers.length === 0) return <EmptyState title="No driver data available." />;

  return (
    <div className="flex flex-col gap-2">
      {drivers.map((d) => {
        const scorePct = ((d.value + 1) / 2) * 100;
        const label = DRIVER_LABELS[d.driver_key] ?? d.driver_key.toUpperCase();
        const description = DRIVER_DESCRIPTIONS[d.driver_key] ?? "";
        return (
          <Tooltip key={d.driver_key}>
            <TooltipTrigger asChild>
              <div className="group flex items-center gap-3 cursor-help">
                <span className="text-small text-mer-ink-secondary w-40 shrink-0 tracking-wide">{label}</span>
                <div className="flex-1 h-4 rounded-[3px] bg-mer-surface-3 overflow-hidden relative ring-1 ring-inset ring-white/[0.04] transition-all duration-fast group-hover:ring-mer-accent-500/20">
                  <div
                    className="h-full origin-left transition-transform duration-[400ms] ease-out group-hover:brightness-110"
                    style={{
                      width: "100%",
                      backgroundColor: scoreToColor(scorePct),
                      transform: `scaleX(${scorePct / 100})`,
                    }}
                  />
                </div>
                <span className="num text-small text-mer-ink-primary w-14 text-right font-medium tabular-nums tracking-tight">{d.value.toFixed(2)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="shadow-mer-raised">
              {label} · weight {(d.weight * 100).toFixed(0)}% · contribution {d.contribution.toFixed(3)}
              {description && <div className="mt-1 text-text-secondary">{description}</div>}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
