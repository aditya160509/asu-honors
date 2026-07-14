import { cn } from "@/lib/utils";
import { MER_EMPHASIS_BG } from "@/components/dashboard/primitives/tokens";

export interface DeltaBarProps {
  value: number;
  cap?: number;
  className?: string;
}

/** Centered magnitude bar for a signed %, scanability aid for dense lists (DESIGN_SPEC: Tables). */
export function DeltaBar({ value, cap = 6, className }: DeltaBarProps) {
  const pct = Math.min(Math.abs(value) / cap, 1) * 100;
  const positive = value >= 0;
  return (
    <div className={cn("relative h-1 w-10 shrink-0 overflow-hidden rounded-full bg-mer-surface-4", className)}>
      <div
        className={cn("absolute inset-y-0 rounded-full", positive ? "left-1/2 bg-positive" : "right-1/2 bg-negative")}
        style={{ width: `${pct / 2}%` }}
      />
      <div className={cn("absolute inset-y-0 left-1/2 w-px", MER_EMPHASIS_BG)} />
    </div>
  );
}
