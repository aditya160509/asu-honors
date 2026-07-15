"use client";

import * as React from "react";
import { ArrowDownAZ, ArrowUpDown, ArrowUpAZ, Download, LayoutList, Rows3 } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ColumnManager } from "@/components/market/ColumnManager";
import type { ColumnDef, ColumnKey, Density } from "@/lib/market/types";
import type { SortState } from "@/components/market/ExplorerTable";

export interface ToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
  totalCount: number;
  columns: ColumnDef[];
  columnOrder: ColumnKey[];
  hiddenColumns: ColumnKey[];
  onToggleColumn: (key: ColumnKey) => void;
  onMoveColumn: (key: ColumnKey, direction: -1 | 1) => void;
  onResetColumns: () => void;
  density: Density;
  onDensityChange: (d: Density) => void;
  onExport: () => void;
  compareCount: number;
  onOpenCompare: () => void;
  sort: SortState;
  onSort: (key: string) => void;
}

export function Toolbar({
  query,
  onQueryChange,
  resultCount,
  totalCount,
  columns,
  columnOrder,
  hiddenColumns,
  onToggleColumn,
  onMoveColumn,
  onResetColumns,
  density,
  onDensityChange,
  onExport,
  compareCount,
  onOpenCompare,
  sort,
  onSort,
}: ToolbarProps) {
  const [sortOpen, setSortOpen] = React.useState(false);
  const sortRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    if (sortOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sortOpen]);

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <SearchInput
        value={query}
        onValueChange={onQueryChange}
        placeholder="Search ticker or name…"
        aria-label="Search companies (ticker or name)"
        containerClassName="w-56"
        debounceMs={150}
      />
      <span className="text-small text-text-secondary num tabular-nums">
        {resultCount.toLocaleString()}
        <span className="text-text-tertiary"> / {totalCount.toLocaleString()}</span>
      </span>

      <div className="flex-1" />

      {/* Sort dropdown */}
      <div className="relative" ref={sortRef}>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1.5 text-micro", sort.key && "text-accent")}
          onClick={() => setSortOpen((v) => !v)}
        >
          {sort.direction === "asc" ? (
            <ArrowUpAZ size={13} />
          ) : sort.direction === "desc" ? (
            <ArrowDownAZ size={13} />
          ) : (
            <ArrowUpDown size={13} />
          )}
          Sort
        </Button>
        {sortOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-bg-secondary shadow-lg py-1">
            {columns.map((col) => (
              <button
                key={col.key}
                onClick={() => {
                  onSort(col.key);
                  setSortOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-micro transition-colors",
                  sort.key === col.key ? "text-accent bg-accent/5" : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                )}
              >
                {sort.key === col.key ? (
                  sort.direction === "asc" ? <ArrowUpAZ size={11} /> : <ArrowDownAZ size={11} />
                ) : (
                  <ArrowUpDown size={11} className="opacity-30" />
                )}
                {col.header}
              </button>
            ))}
          </div>
        )}
      </div>

      {compareCount > 0 && (
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={onOpenCompare}>
          <LayoutList size={13} />
          Compare ({compareCount})
        </Button>
      )}

      {/* Density toggle */}
      <div className="flex items-center rounded-sm border border-border p-0.5">
        <button
          type="button"
          aria-label="Compact density"
          aria-pressed={density === "compact"}
          onClick={() => onDensityChange("compact")}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-sm transition-colors",
            density === "compact" ? "bg-bg-hover text-text-primary" : "text-text-tertiary hover:text-text-primary"
          )}
        >
          <LayoutList size={12} />
        </button>
        <button
          type="button"
          aria-label="Comfortable density"
          aria-pressed={density === "comfortable"}
          onClick={() => onDensityChange("comfortable")}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-sm transition-colors",
            density === "comfortable" ? "bg-bg-hover text-text-primary" : "text-text-tertiary hover:text-text-primary"
          )}
        >
          <Rows3 size={12} />
        </button>
      </div>

      <ColumnManager
        columns={columns}
        order={columnOrder}
        hidden={hiddenColumns}
        onToggle={onToggleColumn}
        onMove={onMoveColumn}
        onReset={onResetColumns}
      />

      <Button variant="ghost" size="sm" className="gap-1.5 text-micro" onClick={onExport}>
        <Download size={13} />
        CSV
      </Button>
    </div>
  );
}
