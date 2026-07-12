import { cn } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

/** Fixed-dimension skeleton — never causes layout shift. */
export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton-shimmer bg-bg-tertiary rounded-sm", className)}
      style={{ width, height }}
    />
  );
}
