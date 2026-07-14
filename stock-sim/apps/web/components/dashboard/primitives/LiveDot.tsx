import { cn } from "@/lib/utils";

export interface LiveDotProps {
  color?: "accent" | "positive" | "negative" | "warning";
  className?: string;
}

const COLOR_CLASS: Record<NonNullable<LiveDotProps["color"]>, string> = {
  accent: "bg-mer-accent-500",
  positive: "bg-positive",
  negative: "bg-negative",
  warning: "bg-warning",
};

/** Breathing live indicator — same ping+dot technique as StatusBar's "Real-time" marker. */
export function LiveDot({ color = "accent", className }: LiveDotProps) {
  const dotColor = COLOR_CLASS[color];
  return (
    <span className={cn("relative inline-flex h-1.5 w-1.5 shrink-0", className)}>
      <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", dotColor)} />
      <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", dotColor)} />
    </span>
  );
}
