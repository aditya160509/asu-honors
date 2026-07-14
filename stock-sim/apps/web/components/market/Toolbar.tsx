"use client";

import { Download, Layers, LayoutList, Rows3 } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ColumnManager } from "@/components/market/ColumnManager";
import type { ColumnDef, ColumnKey, Density } from "@/lib/market/types";

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
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5">
      <SearchInput
        value={query}
        onValueChange={onQueryChange}
        placeholder="Search ticker or name…"
        aria-label="Search companies (ticker or name)"
        containerClassName="w-64"
        debounceMs={150}
      />
      <span className="text-small text-text-secondary num">
        {resultCount.toLocaleString()}
        <span className="text-text-tertiary"> / {totalCount.toLocaleString()}</span>
      </span>

      <div className="flex-1" />

      {compareCount > 0 && (
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={onOpenCompare}>
          <Layers size={13} />
          Compare ({compareCount})
        </Button>
      )}

      <div className="flex items-center rounded-sm border border-border p-0.5">
        <button
          type="button"
          aria-label="Comfortable density"
          aria-pressed={density === "comfortable"}
          onClick={() => onDensityChange("comfortable")}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-[3px] transition-colors",
            density === "comfortable" ? "bg-bg-hover text-text-primary" : "text-text-tertiary hover:text-text-primary"
          )}
        >
          <Rows3 size={13} />
        </button>
        <button
          type="button"
          aria-label="Compact density"
          aria-pressed={density === "compact"}
          onClick={() => onDensityChange("compact")}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-[3px] transition-colors",
            density === "compact" ? "bg-bg-hover text-text-primary" : "text-text-tertiary hover:text-text-primary"
          )}
        >
          <LayoutList size={13} />
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

      <Button variant="ghost" size="sm" className="gap-1.5" onClick={onExport}>
        <Download size={13} />
        Export
      </Button>
    </div>
  );
}
