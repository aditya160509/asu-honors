"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatLarge, formatPct, formatPrice } from "@/lib/utils";

export interface MetricStripItem {
  key: string;
  label: string;
  value: number | null;
  format?: "price" | "pct" | "large" | "number";
  /** Overrides value formatting with a literal display string (e.g. a "Low"/"Moderate"/"High" label). */
  textValue?: string;
  tone?: "neutral" | "auto";
  hint?: string;
  /** When true and both value and textValue are null, the item is not rendered at all — for metrics
   * with no real methodology available, rather than showing a hollow "N/A". */
  omitIfNull?: boolean;
}

export interface MetricStripProps {
  items: MetricStripItem[];
  loading?: boolean;
}

function formatValue(item: MetricStripItem): string {
  if (item.textValue != null) return item.textValue;
  if (item.value == null) return "N/A";
  switch (item.format) {
    case "price":
      return formatPrice(item.value);
    case "pct":
      return formatPct(item.value);
    case "large":
      return formatLarge(item.value);
    default:
      return item.value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
}

/**
 * A slim, hairline-separated band of metrics — the DESIGN_SPEC alternative to a row of equal-width
 * bordered KPI cards. Items with `omitIfNull` disappear entirely when there's no real value to show,
 * rather than fabricating a number or displaying a hollow placeholder.
 */
export function MetricStrip({ items, loading }: MetricStripProps) {
  const visible = items.filter((item) => !(item.omitIfNull && item.value == null && item.textValue == null));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap divide-x divide-[color:var(--mer-stroke-hairline)]">
      {visible.map((item) => {
        const toneClass =
          item.tone === "auto" && item.value != null
            ? item.value > 0
              ? "text-positive"
              : item.value < 0
                ? "text-negative"
                : "text-mer-ink-primary"
            : "text-mer-ink-primary";

        const content = (
          <div className="flex min-w-[120px] flex-1 flex-col gap-1 px-4 py-3">
            <span className="text-micro uppercase tracking-wide text-mer-ink-tertiary">{item.label}</span>
            {loading ? (
              <Skeleton width={64} height={18} />
            ) : (
              <span className={cn("num text-body font-semibold", toneClass)}>{formatValue(item)}</span>
            )}
          </div>
        );

        return item.hint ? (
          <Tooltip key={item.key}>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent>{item.hint}</TooltipContent>
          </Tooltip>
        ) : (
          <React.Fragment key={item.key}>{content}</React.Fragment>
        );
      })}
    </div>
  );
}
