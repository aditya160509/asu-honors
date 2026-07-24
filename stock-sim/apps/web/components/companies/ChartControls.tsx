"use client";

import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import type { ChartType } from "@/lib/charts/types";
import { ChartTypePicker } from "@/components/ui/ChartTypePicker";
import { IndicatorPicker } from "@/components/ui/IndicatorPicker";
import type { IndicatorType } from "@/lib/charts/indicators";

export type TimeframeKey = "1M" | "3M" | "6M" | "1Y" | "ALL";

const TIMEFRAMES: TimeframeKey[] = ["1M", "3M", "6M", "1Y", "ALL"];

export interface ChartControlsProps {
  timeframe: TimeframeKey;
  onTimeframeChange: (tf: TimeframeKey) => void;
  activeIndicators: IndicatorType[];
  onToggleIndicator: (type: IndicatorType) => void;
  showVolumeProfile: boolean;
  onToggleVolumeProfile: () => void;
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
}

/** Timeframe pills + indicator picker/drawing chart-type/volume-profile toggles above the company PriceChart. */
export function ChartControls({
  timeframe,
  onTimeframeChange,
  activeIndicators,
  onToggleIndicator,
  showVolumeProfile,
  onToggleVolumeProfile,
  chartType,
  onChartTypeChange,
}: ChartControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
      <div className="flex items-center rounded-mer-xs bg-mer-surface-1 p-0.5">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => onTimeframeChange(tf)}
            className={cn(
              "h-7 rounded-[3px] px-2.5 text-micro font-medium tracking-wide transition-all duration-fast ease-out-expo focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mer-accent-500",
              timeframe === tf
                ? "bg-mer-surface-3 text-mer-ink-primary shadow-mer-rest"
                : "text-mer-ink-tertiary hover:bg-mer-surface-2 hover:text-mer-ink-secondary"
            )}
          >
            {tf}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <ChartTypePicker value={chartType} onChange={onChartTypeChange} />
        <IndicatorPicker activeIndicators={activeIndicators} onToggle={onToggleIndicator} />
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
