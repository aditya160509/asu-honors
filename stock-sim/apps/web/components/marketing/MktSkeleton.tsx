export interface MktSkeletonProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

/** Marketing-scoped equivalent of components/ui/skeleton.tsx — same sweep animation, mkt-toned colors. */
export function MktSkeleton({ width, height, className }: MktSkeletonProps) {
  return <div className={`mkt-skeleton-sweep ${className ?? ""}`} style={{ width, height }} />;
}
