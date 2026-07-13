import * as React from "react";
import { cn } from "@/lib/utils";
import { GridCell } from "@/lib/grid/GridCell";
import type { GridColumn } from "@/lib/grid/types";

export interface GridRowProps<T> {
  row: T;
  columns: GridColumn<T>[];
  rowHeight: number;
  top: number;
  onClick?: (row: T) => void;
  changedKeys?: Set<string>;
}

function GridRowInner<T>({ row, columns, rowHeight, top, onClick, changedKeys }: GridRowProps<T>) {
  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={() => onClick?.(row)}
      className={cn(
        "flex absolute left-0 right-0 border-b border-border items-center",
        onClick && "cursor-pointer hover:bg-bg-hover"
      )}
      style={{ height: rowHeight, top, transform: `translateY(0)` }}
    >
      {columns.map((col) => {
        const value = col.accessor ? col.accessor(row) : (row as Record<string, unknown>)[col.key];
        const changed = changedKeys?.has(col.key);
        return (
          <div
            key={col.key}
            className={cn(
              "px-3 text-body truncate",
              col.pin === "left" && "sticky left-0 bg-bg-primary z-10"
            )}
            style={{
              width: col.width === "grow" || col.width === "auto" ? undefined : col.width,
              flex: col.width === "grow" ? "1 1 0%" : col.width === "auto" ? "0 1 auto" : "0 0 auto",
              minWidth: typeof col.width === "number" ? col.width : 80,
            }}
          >
            {col.render ? col.render(value, row) : (
              <GridCell value={value} format={col.format} align={col.align} changed={changed} heatCap={col.heatCap} colorize={col.colorize} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export const GridRow = React.memo(GridRowInner) as typeof GridRowInner;
