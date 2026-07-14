"use client";

import { clamp, cn } from "@/lib/utils";
import type { RangeValue } from "@/lib/market/types";
import styles from "@/components/market/RangeSlider.module.css";

export interface RangeSliderProps {
  bounds: RangeValue;
  value: RangeValue;
  onChange: (next: RangeValue) => void;
  formatValue?: (n: number) => string;
  step?: number;
}

/** Dual-thumb range filter: two overlapping native inputs + a mono value readout. */
export function RangeSlider({ bounds, value, onChange, formatValue = (n) => n.toFixed(0), step }: RangeSliderProps) {
  const span = Math.max(bounds.max - bounds.min, 1e-9);
  const resolvedStep = step ?? Math.max(span / 200, 0.01);

  const minPct = ((value.min - bounds.min) / span) * 100;
  const maxPct = ((value.max - bounds.min) / span) * 100;

  function setMin(next: number) {
    onChange({ min: clamp(next, bounds.min, value.max), max: value.max });
  }
  function setMax(next: number) {
    onChange({ min: value.min, max: clamp(next, value.min, bounds.max) });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-micro num text-text-secondary">
        <span>{formatValue(value.min)}</span>
        <span>{formatValue(value.max)}</span>
      </div>
      <div className="relative h-4 flex items-center">
        <div className="absolute inset-x-0 h-[3px] rounded-full bg-bg-tertiary" />
        <div
          className="absolute h-[3px] rounded-full bg-accent"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
        />
        <input
          type="range"
          aria-label="Minimum"
          min={bounds.min}
          max={bounds.max}
          step={resolvedStep}
          value={value.min}
          onChange={(e) => setMin(Number(e.target.value))}
          className={cn(styles.rangeThumb)}
          style={{ zIndex: value.min > bounds.max - span * 0.05 ? 5 : 3 }}
        />
        <input
          type="range"
          aria-label="Maximum"
          min={bounds.min}
          max={bounds.max}
          step={resolvedStep}
          value={value.max}
          onChange={(e) => setMax(Number(e.target.value))}
          className={cn(styles.rangeThumb)}
          style={{ zIndex: 4 }}
        />
      </div>
    </div>
  );
}
