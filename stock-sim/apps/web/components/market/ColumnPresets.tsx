"use client";

import { cn } from "@/lib/utils";
import type { ColumnKey } from "@/lib/market/types";

export interface ColumnPreset {
  key: string;
  label: string;
  columns: ColumnKey[];
}

export const COLUMN_PRESETS: ColumnPreset[] = [
  {
    key: "value",
    label: "Value",
    columns: ["industry", "price", "ivGap", "iv", "marketCap", "marketCapCategory"],
  },
  {
    key: "growth",
    label: "Growth",
    columns: ["industry", "price", "dayChange", "ivGap", "volatility", "marketCapCategory"],
  },
  {
    key: "momentum",
    label: "Momentum",
    columns: ["industry", "price", "prevClose", "dayChange", "volatility"],
  },
  {
    key: "full",
    label: "Full",
    columns: ["industry", "price", "prevClose", "dayChange", "ivGap", "iv", "marketCap", "marketCapCategory", "volatility"],
  },
];

export interface ColumnPresetsProps {
  onPresetChange: (columns: ColumnKey[]) => void;
  activePreset: string | null;
}

export function ColumnPresets({ onPresetChange, activePreset }: ColumnPresetsProps) {
  return (
    <div className="flex items-center gap-0.5">
      {COLUMN_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => onPresetChange(preset.columns)}
          className={cn(
            "px-2 py-0.5 text-micro font-medium rounded-sm transition-colors",
            activePreset === preset.key
              ? "bg-accent/15 text-accent"
              : "text-text-tertiary hover:text-text-secondary hover:bg-bg-hover"
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
