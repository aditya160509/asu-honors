"use client";

import { useSimState } from "@/lib/api/hooks/useSimulation";
import { useCycleState } from "@/lib/api/hooks/useMarket";
import { useCvdMode } from "@/lib/theme/cvd-modes";
import { useAnimatedCounter } from "@/lib/motion";
import { formatDateFull } from "@/lib/utils";

/**
 * Thin status strip along the bottom of the shell — sits below the
 * Sidebar+Content row in normal document flow (not position:fixed), so it
 * never needs to guess the sidebar's current width (expanded/collapsed/
 * mobile-drawer).
 */
export function StatusBar() {
  const { data: simState } = useSimState();
  const { data: cycle } = useCycleState();
  const { mode } = useCvdMode();
  const tick = useAnimatedCounter(simState?.tick_count ?? 0, (v) => Math.round(v).toString());

  return (
    <div className="mer-surface-lit flex h-7 shrink-0 items-center gap-4 border-t border-mer-hairline bg-mer-surface-1 px-4 text-micro text-mer-ink-tertiary">
      <span className="flex items-center gap-1.5 shrink-0">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
        </span>
        Real-time
      </span>
      {simState && (
        <span className="font-mono truncate">
          {formatDateFull(simState.current_sim_date)} · Tick #{tick}
        </span>
      )}
      {cycle && <span className="capitalize shrink-0">{cycle.cycle_phase}</span>}
      <span className="ml-auto shrink-0">CVD: {mode === "normal" ? "Normal" : mode}</span>
    </div>
  );
}
