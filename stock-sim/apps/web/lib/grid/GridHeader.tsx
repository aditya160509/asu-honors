import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GridColumn, SortState } from "@/lib/grid/types";

export interface GridHeaderProps<T> {
  columns: GridColumn<T>[];
  sort: SortState;
  onSort: (key: string) => void;
  sortable?: boolean;
}

export function GridHeader<T>({ columns, sort, onSort, sortable = true }: GridHeaderProps<T>) {
  return (
    <div className="flex border-b border-border bg-bg-secondary sticky top-0 z-10">
      {columns.map((col) => {
        const isSorted = sort.key === col.key;
        const canSort = sortable && col.sortable !== false;
        return (
          <div
            key={col.key}
            role={canSort ? "button" : undefined}
            tabIndex={canSort ? 0 : undefined}
            onClick={() => canSort && onSort(col.key)}
            onKeyDown={(e) => {
              if (canSort && (e.key === "Enter" || e.key === " ")) onSort(col.key);
            }}
            className={cn(
              "flex items-center gap-1 px-3 py-2 text-small font-medium text-text-secondary select-none",
              canSort && "cursor-pointer hover:text-text-primary",
              col.align === "right" && "justify-end text-right",
              col.align === "center" && "justify-center text-center",
              col.pin === "left" && "sticky left-0 bg-bg-secondary z-20"
            )}
            style={{
              width: col.width === "grow" || col.width === "auto" ? undefined : col.width,
              flex: col.width === "grow" ? "1 1 0%" : col.width === "auto" ? "0 1 auto" : "0 0 auto",
              minWidth: typeof col.width === "number" ? col.width : 80,
            }}
          >
            <span>{col.header}</span>
            {isSorted && sort.direction === "asc" && <ArrowUp size={12} className="text-accent" />}
            {isSorted && sort.direction === "desc" && <ArrowDown size={12} className="text-accent" />}
          </div>
        );
      })}
    </div>
  );
}
