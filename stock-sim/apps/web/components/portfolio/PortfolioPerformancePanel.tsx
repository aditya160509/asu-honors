"use client";

import * as React from "react";
import { LineChart } from "lucide-react";
import { RangeSelector } from "@/components/dashboard/primitives/RangeSelector";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { usePortfolioHistory } from "@/lib/api/hooks/usePortfolio";
import { usePortfolioHeader } from "@/components/portfolio/PortfolioHeaderContext";
import { cn, formatPrice } from "@/lib/utils";
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

const glassCard: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(22, 26, 33, 0.95) 0%, rgba(29, 34, 43, 0.95) 100%)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid var(--mer-stroke-hairline)",
  borderRadius: "var(--mer-radius-md)",
  overflow: "hidden",
};

const statsBar: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "24px",
  padding: "16px 20px",
  borderBottom: "1px solid var(--mer-stroke-hairline)",
};

const statItem: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const statLabel: React.CSSProperties = {
  fontSize: "var(--fs-micro)",
  fontWeight: 500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "var(--mer-ink-tertiary)",
};

const statValue: React.CSSProperties = {
  fontSize: "var(--fs-h3)",
  fontWeight: 600,
  fontFamily: "var(--font-mono)",
  color: "var(--mer-ink-primary)",
  lineHeight: 1.2,
};

const toggleTrack: React.CSSProperties = {
  position: "relative",
  width: "36px",
  height: "20px",
  borderRadius: "10px",
  border: "1px solid var(--mer-stroke-emphasis)",
  backgroundColor: "var(--mer-surface-3)",
  cursor: "pointer",
  transition: "all 0.2s ease",
  flexShrink: 0,
};

const toggleTrackActive: React.CSSProperties = {
  ...toggleTrack,
  backgroundColor: "var(--mer-accent-500)",
  borderColor: "var(--mer-accent-500)",
  boxShadow: "0 0 12px rgba(62, 111, 224, 0.35)",
};

const toggleKnob: React.CSSProperties = {
  position: "absolute",
  top: "2px",
  left: "2px",
  width: "14px",
  height: "14px",
  borderRadius: "50%",
  backgroundColor: "white",
  transition: "transform 0.2s ease",
  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
};

function toEpoch(simDate: string): number {
  return new Date(simDate).getTime();
}

function normalizePct(points: LinePoint[]): LinePoint[] {
  if (points.length === 0) return points;
  const base = points[0].value;
  if (base === 0) return points.map((p) => ({ time: p.time, value: 0 }));
  return points.map((p) => ({ time: p.time, value: (p.value / base - 1) * 100 }));
}

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

  const currentValue = points.length > 0 ? points[points.length - 1].value : 0;
  const dayChange = points.length >= 2 ? points[points.length - 1].value - points[points.length - 2].value : 0;
  const dayChangePct = points.length >= 2 && points[points.length - 2].value > 0
    ? ((points[points.length - 1].value / points[points.length - 2].value) - 1) * 100
    : 0;
  const totalReturn = points.length >= 2 ? points[points.length - 1].value - points[0].value : 0;
  const totalReturnPct = points.length >= 2 && points[0].value > 0
    ? ((points[points.length - 1].value / points[0].value) - 1) * 100
    : 0;

  return (
    <div style={glassCard}>
      <header
        className="flex items-center justify-between gap-3 px-5 py-3.5"
        style={{ borderBottom: "1px solid var(--mer-stroke-hairline)" }}
      >
        <div className="flex items-center gap-2">
          <LineChart size={14} className="text-mer-accent-500" />
          <div className="flex flex-col">
            <span
              className="font-medium uppercase"
              style={{ fontSize: "var(--fs-micro)", color: "var(--mer-ink-tertiary)", letterSpacing: "0.08em" }}
            >
              Performance
            </span>
            <span className="text-body font-semibold text-mer-ink-primary">Portfolio Value</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-micro text-mer-ink-tertiary">Compare Market</span>
          <button
            type="button"
            onClick={() => setCompare((c) => !c)}
            aria-pressed={compare}
            style={compare ? toggleTrackActive : toggleTrack}
            role="switch"
          >
            <span style={{ ...toggleKnob, transform: compare ? "translateX(16px)" : "translateX(0)" }} />
          </button>
        </div>
      </header>

      {points.length >= 2 && (
        <div style={statsBar}>
          <div style={statItem}>
            <span style={statLabel}>Current Value</span>
            <span style={statValue}>{formatPrice(currentValue)}</span>
          </div>
          <div style={statItem}>
            <span style={statLabel}>Day Change</span>
            <span style={{ ...statValue, color: dayChange >= 0 ? "var(--positive)" : "var(--negative)" }}>
              {dayChange >= 0 ? "+" : ""}{formatPrice(dayChange)}
              <span style={{ fontSize: "var(--fs-small)", marginLeft: "6px", opacity: 0.8 }}>
                ({dayChangePct >= 0 ? "+" : ""}{dayChangePct.toFixed(2)}%)
              </span>
            </span>
          </div>
          <div style={statItem}>
            <span style={statLabel}>Total Return ({range})</span>
            <span style={{ ...statValue, color: totalReturn >= 0 ? "var(--positive)" : "var(--negative)" }}>
              {totalReturn >= 0 ? "+" : ""}{formatPrice(totalReturn)}
              <span style={{ fontSize: "var(--fs-small)", marginLeft: "6px", opacity: 0.8 }}>
                ({totalReturnPct >= 0 ? "+" : ""}{totalReturnPct.toFixed(2)}%)
              </span>
            </span>
          </div>
        </div>
      )}

      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
        style={{ borderBottom: "1px solid var(--mer-stroke-hairline)" }}
      >
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
        <div className="p-5">
          <Skeleton height={300} className="w-full" />
        </div>
      ) : history.isError ? (
        <div className="p-5">
          <ErrorState message="Could not load performance history." onRetry={() => history.refetch()} />
        </div>
      ) : insufficient ? (
        <div className="flex h-[300px] items-center justify-center px-6 text-center">
          <p className="max-w-xs text-small text-mer-ink-secondary">
            Not enough history yet — check back after your first few days of trading, or pick a shorter range.
          </p>
        </div>
      ) : (
        <div className="px-2 py-2">
          <PerformanceChart
            portfolioValues={chartSeries}
            indexValues={chartBenchmark}
            height={320}
            color={ACCENT}
            formatY={formatY}
            seriesLabel="Portfolio"
            indexLabel="Market"
          />
        </div>
      )}
    </div>
  );
}
