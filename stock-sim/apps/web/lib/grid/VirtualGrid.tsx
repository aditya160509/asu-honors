"use client";

import * as React from "react";
import { GridHeader } from "@/lib/grid/GridHeader";
import { GridRow } from "@/lib/grid/GridRow";
import { GridSkeleton } from "@/lib/grid/GridSkeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useGridSort } from "@/lib/grid/useGridSort";
import type { GridColumn } from "@/lib/grid/types";

export interface VirtualGridProps<T> {
  data: T[];
  columns: GridColumn<T>[];
  rowHeight?: number;
  overscan?: number;
  onRowClick?: (row: T) => void;
  sortable?: boolean;
  loading?: boolean;
  error?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  errorMessage?: string;
  onRetry?: () => void;
  height?: number;
  getRowId: (row: T) => string | number;
  /** Set of row ids whose values changed since last render — flashes matching cells. */
  changedRowIds?: Set<string | number>;
}

/**
 * Custom virtual-scrolling grid. Computes visible window from scrollTop,
 * renders only [visibleStart, visibleStart+visibleCount] rows, pads with
 * top/bottom spacer divs, absolutely positions visible rows via `top`.
 */
export function VirtualGrid<T>({
  data,
  columns,
  rowHeight = 36,
  overscan = 5,
  onRowClick,
  sortable = true,
  loading,
  error,
  emptyTitle = "No data",
  emptyDescription,
  errorMessage = "Could not load data.",
  onRetry,
  height = 600,
  getRowId,
  changedRowIds,
}: VirtualGridProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [containerHeight, setContainerHeight] = React.useState(height);

  const { sortedData, sort, toggleSort } = useGridSort(data, columns);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h) setContainerHeight(h);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    setScrollTop(e.currentTarget.scrollTop);
  }

  const totalRows = sortedData.length;
  const visibleStart = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / rowHeight) + overscan * 2;
  const visibleEnd = Math.min(totalRows, visibleStart + visibleCount);

  const topPadding = visibleStart * rowHeight;
  const bottomPadding = (totalRows - visibleEnd) * rowHeight;

  if (loading) {
    return (
      <div className="border border-border rounded-md overflow-hidden">
        <GridHeader columns={columns} sort={sort} onSort={toggleSort} sortable={sortable} />
        <GridSkeleton rows={15} rowHeight={rowHeight} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-border rounded-md">
        <ErrorState message={errorMessage} onRetry={onRetry} />
      </div>
    );
  }

  if (totalRows === 0) {
    return (
      <div className="border border-border rounded-md">
        <GridHeader columns={columns} sort={sort} onSort={toggleSort} sortable={sortable} />
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md overflow-hidden flex flex-col" style={{ height }}>
      <GridHeader columns={columns} sort={sort} onSort={toggleSort} sortable={sortable} />
      <div ref={containerRef} onScroll={handleScroll} className="overflow-y-auto flex-1 relative">
        <div style={{ height: topPadding }} />
        <div style={{ position: "relative", height: (visibleEnd - visibleStart) * rowHeight }}>
          {sortedData.slice(visibleStart, visibleEnd).map((row, i) => (
            <GridRow
              key={getRowId(row)}
              row={row}
              columns={columns}
              rowHeight={rowHeight}
              top={i * rowHeight}
              onClick={onRowClick}
              changedKeys={changedRowIds?.has(getRowId(row)) ? new Set(columns.map((c) => c.key)) : undefined}
            />
          ))}
        </div>
        <div style={{ height: bottomPadding }} />
      </div>
    </div>
  );
}
