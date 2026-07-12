import { Skeleton } from "@/components/ui/skeleton";

export interface GridSkeletonProps {
  rows?: number;
  rowHeight?: number;
  columnWidths?: number[];
}

export function GridSkeleton({ rows = 15, rowHeight = 36, columnWidths = [80, 200, 100, 100, 90, 80, 90, 80] }: GridSkeletonProps) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 border-b border-border"
          style={{ height: rowHeight }}
        >
          {columnWidths.map((w, j) => (
            <Skeleton key={j} width={Math.max(24, w - 24)} height={12} />
          ))}
        </div>
      ))}
    </div>
  );
}
