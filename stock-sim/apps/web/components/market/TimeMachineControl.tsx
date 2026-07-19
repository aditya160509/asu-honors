"use client";

import * as React from "react";
import { History, Pause, Play, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const STEP_OPTIONS = [1, 5, 30] as const;
type StepDays = (typeof STEP_OPTIONS)[number];

export interface TimeMachineControlProps {
  /** null when viewing live data. */
  asOfDate: string | null;
  /** Live sim date (YYYY-MM-DD) — the upper bound; playback stops here. */
  maxDate: string;
  /** null goes back to live. */
  onDateChange: (date: string | null) => void;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Date picker + step-through playback for viewing the market as it stood on
 * a past sim date — "advance N days per tick" against the real historical
 * snapshot endpoint, not a 60fps animation loop (see plan: full per-row
 * candle interpolation across ~150 rows was ruled out as excessive). */
export function TimeMachineControl({ asOfDate, maxDate, onDateChange }: TimeMachineControlProps) {
  const [stepDays, setStepDays] = React.useState<StepDays>(1);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const isLive = asOfDate === null;

  // Read the latest asOfDate from a ref inside the interval instead of the
  // prop directly — the effect only restarts on isPlaying/stepDays/maxDate,
  // so a stale closure would otherwise keep recomputing from the same
  // starting date every tick instead of advancing.
  const asOfDateRef = React.useRef(asOfDate);
  asOfDateRef.current = asOfDate;

  React.useEffect(() => {
    if (!isPlaying || isLive) return;
    const id = setInterval(() => {
      const current = asOfDateRef.current;
      if (current === null) return;
      const next = addDays(current, stepDays);
      if (next >= maxDate) {
        setIsPlaying(false);
        onDateChange(null); // reached live — snap back
      } else {
        onDateChange(next);
      }
    }, 800);
    return () => clearInterval(id);
  }, [isPlaying, isLive, stepDays, maxDate, onDateChange]);

  function goLive() {
    setIsPlaying(false);
    onDateChange(null);
  }

  return (
    <div className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
      <button
        type="button"
        onClick={goLive}
        title="Return to the live market"
        className={cn(
          "flex h-6 items-center gap-1.5 rounded-sm border px-2 uppercase tracking-[0.04em] transition-colors",
          isLive
            ? "border-[var(--term-up)] text-[var(--term-up)]"
            : "border-transparent text-[var(--term-ink-secondary)] hover:border-[var(--term-divider)] hover:text-[var(--term-ink)]"
        )}
      >
        <Radio size={12} />
        Live
      </button>

      <input
        type="date"
        value={asOfDate ?? maxDate}
        max={maxDate}
        onChange={(e) => e.target.value && onDateChange(e.target.value)}
        title="View the market as of this date"
        className={cn(
          "h-6 rounded-sm border bg-transparent px-2 tabular-nums outline-none",
          isLive ? "border-[var(--term-divider)] text-[var(--term-ink-tertiary)]" : "border-[var(--term-amber)] text-[var(--term-ink)]"
        )}
      />

      {!isLive && (
        <>
          <button
            type="button"
            onClick={() => setIsPlaying((v) => !v)}
            title={isPlaying ? "Pause" : "Step forward automatically"}
            className="flex h-6 w-6 items-center justify-center rounded-sm border border-[var(--term-divider)] text-[var(--term-ink-secondary)] hover:text-[var(--term-ink)]"
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <div className="flex items-center gap-0.5">
            {STEP_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setStepDays(d)}
                className={cn(
                  "flex h-6 items-center rounded-sm border px-1.5 uppercase tracking-[0.04em] transition-colors",
                  stepDays === d
                    ? "border-[var(--term-amber)] text-[var(--term-amber)]"
                    : "border-transparent text-[var(--term-ink-tertiary)] hover:text-[var(--term-ink-secondary)]"
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1 text-[var(--term-amber)]">
            <History size={12} />
            Historical
          </span>
        </>
      )}
    </div>
  );
}
