"use client";

import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import type { IndicatorKey } from "@/components/charts/PriceChart";
import type { ChartType } from "@/lib/charts/types";
import { ChartTypePicker } from "@/components/ui/ChartTypePicker";
import { OverlayPicker } from "@/components/ui/OverlayPicker";

export type TimeframeKey = "1M" | "3M" | "6M" | "1Y" | "ALL";

const TIMEFRAMES: TimeframeKey[] = ["1M", "3M", "6M", "1Y", "ALL"];
const INDICATORS: { key: IndicatorKey; label: string }[] = [
  { key: "sma20", label: "SMA 20" },
  { key: "sma50", label: "SMA 50" },
  { key: "ema12", label: "EMA 12" },
];

export interface ChartControlsProps {
  timeframe: TimeframeKey;
  onTimeframeChange: (tf: TimeframeKey) => void;
  indicators: IndicatorKey[];
  onToggleIndicator: (key: IndicatorKey) => void;
  showVolumeProfile: boolean;
  onToggleVolumeProfile: () => void;
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  activeOverlays: string[];
  onToggleOverlay: (id: string) => void;
  onClearOverlays: () => void;
}

/** Timeframe pills + indicator/volume-profile toggle chips above the company PriceChart. */
export function ChartControls({
  timeframe,
  onTimeframeChange,
  indicators,
  onToggleIndicator,
  showVolumeProfile,
  onToggleVolumeProfile,
  chartType,
  onChartTypeChange,
  activeOverlays,
  onToggleOverlay,
  onClearOverlays,
}: ChartControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
      <div className="flex items-center gap-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => onTimeframeChange(tf)}
            className={cn(
              "h-7 rounded-sm px-2.5 text-micro font-medium transition-colors",
              timeframe === tf
                ? "bg-accent-dim text-accent"
                : "text-text-tertiary hover:bg-bg-hover hover:text-text-secondary"
            )}
          >
            {tf}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <ChartTypePicker value={chartType} onChange={onChartTypeChange} />
        <OverlayPicker activeIds={activeOverlays} onToggle={onToggleOverlay} onClearAll={onClearOverlays} />
        {INDICATORS.map((ind) => (
          <Chip
            key={ind.key}
            variant={indicators.includes(ind.key) ? "selected" : "default"}
            onClick={() => onToggleIndicator(ind.key)}
          >
            {ind.label}
          </Chip>
        ))}
        <Chip variant={showVolumeProfile ? "selected" : "default"} onClick={onToggleVolumeProfile}>
          Volume Profile
        </Chip>
      </div>
    </div>
  );
}

/** Slices already-fetched history to the last N trading bars for a timeframe — client-side, no refetch. */
export function sliceByTimeframe<T>(items: T[], timeframe: TimeframeKey): T[] {
  if (timeframe === "ALL") return items;
  const bars: Record<Exclude<TimeframeKey, "ALL">, number> = { "1M": 21, "3M": 63, "6M": 126, "1Y": 252 };
  return items.slice(-bars[timeframe]);
}
