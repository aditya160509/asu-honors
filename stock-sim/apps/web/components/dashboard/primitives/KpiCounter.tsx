"use client";

import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnimatedCounter } from "@/lib/motion";
import { cn, formatLarge, formatPct, formatPrice } from "@/lib/utils";
import { DeltaBadge } from "@/components/dashboard/primitives/DeltaBadge";

export interface KpiCounterProps {
  label: string;
  value: number;
  format?: "price" | "pct" | "large" | "number";
  icon?: LucideIcon;
  delta?: number | null;
  loading?: boolean;
  size?: "sm" | "lg";
  /** "auto" colors the numeral itself by sign (for values that are already a delta, e.g. total return %). */
  tone?: "neutral" | "auto";
}

function formatValue(value: number, format: NonNullable<KpiCounterProps["format"]>): string {
  if (format === "price") return formatPrice(value);
  if (format === "pct") return formatPct(value);
  if (format === "large") return formatLarge(value);
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** Animated counter tile — wraps the existing useAnimatedCounter GSAP hook (lib/motion), not a new tween. */
export function KpiCounter({
  label,
  value,
  format = "number",
  icon: Icon,
  delta,
  loading,
  size = "sm",
  tone = "neutral",
}: KpiCounterProps) {
  const display = useAnimatedCounter(value, (v) => formatValue(v, format));
  const toneClass =
    tone === "auto" ? (value > 0 ? "text-positive" : value < 0 ? "text-negative" : "text-mer-ink-primary") : "text-mer-ink-primary";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">
        {Icon && <Icon size={11} />}
        {label}
      </span>
      {loading ? (
        <Skeleton width={size === "lg" ? 120 : 84} height={size === "lg" ? 32 : 22} />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className={cn("num font-semibold", size === "lg" ? "text-h1" : "text-h3", toneClass)}>{display}</span>
          {delta !== undefined && <DeltaBadge value={delta} />}
        </div>
      )}
    </div>
  );
}
