"use client";

import * as React from "react";
import { LineChart } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { RangeSelector } from "@/components/dashboard/primitives/RangeSelector";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { usePortfolioHistory } from "@/lib/api/hooks/usePortfolio";
import { usePortfolioHeader } from "@/components/portfolio/PortfolioHeaderContext";
import { cn } from "@/lib/utils";
import type { PerformanceRange } from "@/lib/api/types";
import type { LinePoint } from "@/lib/charts/types";

const RANGE_OPTIONS: { value: PerformanceRange; label: string }[] = [
  { value: "1D", label: "1D" },
  { value: "5D", label: "5D" },
  { value: "1M", label: "1M" },
  { value: "6M", label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "1Y", label: "1Y" },
  { value: "5Y", label: "5Y" },
  { value: "MAX", label: "Max" },
];

const ACCENT = "#3e6fe0";

function toEpoch(simDate: string): number {
  return new Date(simDate).getTime();
}

function normalizePct(points: LinePoint[]): LinePoint[] {
  if (points.length === 0) return points;
  const base = points[0].value;
  if (base === 0) return points.map((p) => ({ time: p.time, value: 0 }));
  return points.map((p) => ({ time: p.time, value: (p.value / base - 1) * 100 }));
}

/**
 * C3 — Performance: portfolio-value area chart over the reconstructed daily NAV
 * series, ghost-pill range selector, and a comparison mode that overlays the
 * equal-weight market composite normalized to % change from range start (the
 * two series live on different scales, so absolute overlay would be a lie).
 * The selected range's delta is published to the shared identity bar (C0).
 */
export function PortfolioPerformancePanel() {
  const [range, setRange] = React.useState<PerformanceRange>("1M");
  const [compare, setCompare] = React.useState(false);
  const history = usePortfolioHistory(range);
  const { setRangeDelta } = usePortfolioHeader();

  const points = React.useMemo<LinePoint[]>(
    () => (history.data?.points ?? []).map((p) => ({ time: toEpoch(p.sim_date), value: Number(p.total_value) })),
    [history.data]
  );
  const benchmark = React.useMemo<LinePoint[]>(
    () => (history.data?.benchmark ?? []).map((b) => ({ time: toEpoch(b.sim_date), value: Number(b.value) })),
    [history.data]
  );

  // Publish this range's delta to the identity bar; clear when leaving the tab.
  React.useEffect(() => {
    if (points.length >= 2) {
      const first = points[0].value;
      const last = points[points.length - 1].value;
      setRangeDelta({
        label: `${range} change`,
        deltaValue: last - first,
        deltaPct: first > 0 ? (last / first - 1) * 100 : 0,
      });
    } else {
      setRangeDelta(null);
    }
    return () => setRangeDelta(null);
  }, [points, range, setRangeDelta]);

  const insufficient = !history.isLoading && !history.isError && points.length < 2;

  const chartSeries = compare ? normalizePct(points) : points;
  const chartBenchmark = compare ? normalizePct(benchmark) : undefined;
  const formatY = compare
    ? (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
    : undefined;

  return (
    <DashboardPanel
      eyebrow="Performance"
      title="Portfolio Value"
      icon={LineChart}
      edge="accent"
      noBodyPadding
      actions={
        <button
          type="button"
          onClick={() => setCompare((c) => !c)}
          aria-pressed={compare}
          className={cn(
            "rounded-mer-xs px-2 py-1 text-micro font-medium uppercase tracking-wide transition-colors",
            compare ? "bg-mer-surface-4 text-mer-ink-primary" : "text-mer-ink-tertiary hover:text-mer-ink-primary"
          )}
        >
          + Compare Market
        </button>
      }
    >
      <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5", MER_HAIRLINE)}>
        <RangeSelector options={RANGE_OPTIONS} value={range} onChange={setRange} />
        {compare && (
          <div className="flex items-center gap-3 text-micro text-mer-ink-tertiary">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ backgroundColor: ACCENT }} /> Portfolio
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded border-b border-dashed" style={{ borderColor: "#5c5c62" }} /> Market composite
            </span>
          </div>
        )}
      </div>

      {history.isLoading ? (
        <div className="p-4">
          <Skeleton height={300} className="w-full" />
        </div>
      ) : history.isError ? (
        <div className="p-4">
          <ErrorState message="Could not load performance history." onRetry={() => history.refetch()} />
        </div>
      ) : insufficient ? (
        <div className="flex h-[300px] items-center justify-center px-6 text-center">
          <p className="max-w-xs text-small text-mer-ink-secondary">
            Not enough history yet — check back after your first few days of trading, or pick a shorter range.
          </p>
        </div>
      ) : (
        <PerformanceChart
          portfolioValues={chartSeries}
          indexValues={chartBenchmark}
          height={320}
          color={ACCENT}
          formatY={formatY}
          seriesLabel="Portfolio"
          indexLabel="Market"
        />
      )}
    </DashboardPanel>
  );
}
