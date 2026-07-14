import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn, formatPct } from "@/lib/utils";

export interface DeltaBadgeProps {
  value: number | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

/** Signed % + direction glyph — color is never the only signal (accessibility, per DESIGN_SPEC). */
export function DeltaBadge({ value, size = "sm", className }: DeltaBadgeProps) {
  if (value == null) return <span className={cn("num text-mer-ink-tertiary", className)}>N/A</span>;

  const iconSize = size === "sm" ? 11 : 13;
  const positive = value > 0;
  const negative = value < 0;

  return (
    <span
      className={cn(
        "num inline-flex items-center gap-0.5 font-medium",
        size === "sm" ? "text-small" : "text-body",
        positive && "text-positive",
        negative && "text-negative",
        !positive && !negative && "text-mer-ink-tertiary",
        className
      )}
    >
      {positive && <ArrowUp size={iconSize} />}
      {negative && <ArrowDown size={iconSize} />}
      {!positive && !negative && <Minus size={iconSize} />}
      {formatPct(value)}
    </span>
  );
}
