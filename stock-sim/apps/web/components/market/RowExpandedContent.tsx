"use client";

import * as React from "react";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import { drawLineSeries, lineYDomain } from "@/lib/charts/series/LineSeries";
import type { LinePoint } from "@/lib/charts/types";
import { cn, cssVar, formatLarge, formatPct, formatPrice } from "@/lib/utils";
import type { EnrichedCompany } from "@/lib/market/types";

function generateSparkData(row: EnrichedCompany): LinePoint[] {
  const n = 10;
  const start = row.prev_close ?? row.current_price * 0.98;
  const end = row.current_price;
  const range = Math.abs(end - start) || 1;

  let seed = 0;
  for (let i = 0; i < row.ticker.length; i++) {
    seed = ((seed << 5) - seed + row.ticker.charCodeAt(i)) | 0;
  }

  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const base = start + (end - start) * t;
    const hash = Math.sin(seed + i * 7.13) * 10000;
    const noise = ((hash % 1) - 0.5) * range * 0.02;
    return { time: i, value: base + noise };
  });
}

const SPARK_PADDING = { top: 4, right: 2, bottom: 4, left: 2 };

function SparkChart({ data, color }: { data: LinePoint[]; color: string }) {
  const render = React.useCallback(
    ({ ctx, width, height }: { ctx: CanvasRenderingContext2D; width: number; height: number }) => {
      if (data.length < 2) return;
      const yDomain = lineYDomain(data);
      drawLineSeries({ ctx, data, width, height, padding: SPARK_PADDING, yDomain, color, lineWidth: 1.5, fill: color });
    },
    [data, color]
  );

  if (data.length < 2) return null;

  return (
    <ChartSurface height={60} padding={SPARK_PADDING} className="pointer-events-none">
      {render}
    </ChartSurface>
  );
}

function StatCell({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-micro text-[color:var(--term-ink-tertiary)] uppercase tracking-wider">{label}</span>
      <span className={cn("text-small font-medium font-mono tabular-nums", className)}>{value}</span>
    </div>
  );
}

export function RowExpandedContent({ row }: { row: EnrichedCompany }) {
  const sparkData = React.useMemo(() => generateSparkData(row), [row]);

  const sparkColor = row.ivGapPct != null && row.ivGapPct < -3
    ? cssVar("--term-up") || "#22c55e"
    : row.ivGapPct != null && row.ivGapPct > 3
      ? cssVar("--term-down") || "#ef4444"
      : cssVar("--term-accent") || "#6366f1";

  const ivGapClass = row.ivGapPct == null
    ? "text-[color:var(--term-ink-tertiary)]"
    : row.ivGapPct < -3
      ? "text-[color:var(--term-up)]"
      : row.ivGapPct > 3
        ? "text-[color:var(--term-down)]"
        : "text-[color:var(--term-ink-secondary)]";

  return (
    <div className="flex h-full items-stretch border-t border-[var(--term-hairline)]/40 bg-[var(--term-bg)]/40">
      <div className="w-[180px] shrink-0 py-1.5 pl-2 pr-1">
        <SparkChart data={sparkData} color={sparkColor} />
      </div>
      <div className="flex items-center gap-4 overflow-x-auto px-3 scrollbar-none">
        <StatCell label="Price" value={formatPrice(row.current_price)} />
        <StatCell label="Intrinsic" value={row.intrinsic_value != null ? formatPrice(row.intrinsic_value) : "—"} />
        <StatCell label="IV Gap" value={row.ivGapPct != null ? formatPct(row.ivGapPct) : "—"} className={ivGapClass} />
        <StatCell label="Mkt Cap" value={row.market_cap != null ? formatLarge(row.market_cap) : "—"} />
        <StatCell label="Vol" value={row.volatility != null ? formatPct(Number(row.volatility)) : "—"} />
        <StatCell label="Avg Vol" value={row.avg_volume_20d != null ? formatLarge(row.avg_volume_20d) : "—"} />
        <StatCell label="52W High" value={row.high_52w != null ? formatPrice(row.high_52w) : "—"} />
        <StatCell label="52W Low" value={row.low_52w != null ? formatPrice(row.low_52w) : "—"} />
        <div className="flex flex-col gap-0.5">
          <span className="text-micro text-[color:var(--term-ink-tertiary)] uppercase tracking-wider">Sector</span>
          <span className="text-small text-[color:var(--term-ink-secondary)] normal-case truncate max-w-[140px]">{row.industry_name}</span>
        </div>
      </div>
    </div>
  );
}
