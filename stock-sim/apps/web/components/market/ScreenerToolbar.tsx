"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  ArrowUpAZ,
  ArrowUpDown,
  Check,
  Columns3,
  Download,
  Gauge,
  LayoutList,
  Rows3,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnDef, ColumnKey, Density } from "@/lib/market/types";
import type { SortState } from "@/components/market/ExplorerTable";

export interface ScreenerToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
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
  onSort: (key: string, shiftKey?: boolean) => void;
  showHighlights: boolean;
  onToggleHighlights: () => void;
  showSentiment: boolean;
  onToggleSentiment: () => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  /** Right-aligned extra controls (e.g. the historical time-machine picker). */
  rightSlot?: React.ReactNode;
}

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, onClose, ref]);
}

function ToolbarButton({
  active,
  onClick,
  icon,
  label,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors",
        active
          ? "border-[var(--term-amber)] text-[var(--term-amber)]"
          : "border-transparent text-[var(--term-ink-secondary)] hover:border-[var(--term-divider)] hover:text-[var(--term-ink)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Restores the discoverable, always-visible sort/columns/density/export/
 * compare/highlights controls that the Bloomberg-style command-line rebuild
 * had moved entirely behind `>commands` and keyboard shortcuts — those still
 * work, this just makes them visible too, styled to match the terminal
 * chrome instead of the app's generic (non-mono) button system. */
export function ScreenerToolbar({
  query,
  onQueryChange,
  searchInputRef,
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
  showHighlights,
  onToggleHighlights,
  showSentiment,
  onToggleSentiment,
  filtersOpen,
  onToggleFilters,
  activeFilterCount,
  rightSlot,
}: ScreenerToolbarProps) {
  const [sortOpen, setSortOpen] = React.useState(false);
  const [colsOpen, setColsOpen] = React.useState(false);
  const sortRef = React.useRef<HTMLDivElement>(null);
  const colsRef = React.useRef<HTMLDivElement>(null);
  useOutsideClose(sortRef, sortOpen, () => setSortOpen(false));
  useOutsideClose(colsRef, colsOpen, () => setColsOpen(false));

  const byKey = new Map(columns.map((c) => [c.key, c]));
  const orderedColumns = columnOrder.map((k) => byKey.get(k)).filter((c): c is ColumnDef => Boolean(c));

  return (
    <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-b border-[var(--term-hairline)] bg-[var(--term-bg)] px-4 py-1.5">
      <ToolbarButton
        active={filtersOpen || activeFilterCount > 0}
        onClick={onToggleFilters}
        icon={<SlidersHorizontal size={12} />}
        label={activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
        title="Open the filter panel (or press f)"
      />

      <input
        ref={searchInputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Quick search…"
        spellCheck={false}
        autoComplete="off"
        aria-label="Quick search (ticker or name)"
        className="h-6 w-44 shrink-0 border border-[var(--term-divider)] bg-transparent px-2 font-mono text-[11px] text-[var(--term-ink)] outline-none placeholder:text-[var(--term-ink-tertiary)] focus:border-[var(--term-amber)]"
      />

      <div className="relative shrink-0" ref={sortRef}>
        <ToolbarButton
          active={Boolean(sort.key)}
          onClick={() => setSortOpen((v) => !v)}
          icon={
            sort.direction === "asc" ? (
              <ArrowUpAZ size={12} />
            ) : sort.direction === "desc" ? (
              <ArrowDownAZ size={12} />
            ) : (
              <ArrowUpDown size={12} />
            )
          }
          label="Sort"
        />
        {sortOpen && (
          <div className="absolute left-0 top-full z-40 mt-1 w-52 border border-[var(--term-divider)] bg-[var(--term-bg)] py-1 shadow-[0_8px_24px_rgba(4,6,10,0.5)] shadow-[0_0_0_1px_var(--mer-stroke-emphasis)]">
            {orderedColumns.map((col) => (
              <button
                key={col.key}
                type="button"
                onClick={() => {
                  onSort(col.key);
                  setSortOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] uppercase tracking-[0.04em] transition-colors",
                  sort.key === col.key
                    ? "text-[var(--term-amber)]"
                    : "text-[var(--term-ink-secondary)] hover:bg-white/5 hover:text-[var(--term-ink)]"
                )}
              >
                {sort.key === col.key ? (
                  sort.direction === "asc" ? (
                    <ArrowUpAZ size={11} />
                  ) : (
                    <ArrowDownAZ size={11} />
                  )
                ) : (
                  <ArrowUpDown size={11} className="opacity-30" />
                )}
                {col.header}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative shrink-0" ref={colsRef}>
        <ToolbarButton active={colsOpen} onClick={() => setColsOpen((v) => !v)} icon={<Columns3 size={12} />} label="Columns" />
        {colsOpen && (
          <div className="absolute left-0 top-full z-40 mt-1 w-64 border border-[var(--term-divider)] bg-[var(--term-bg)] py-1 shadow-[0_8px_24px_rgba(4,6,10,0.5)] shadow-[0_0_0_1px_var(--mer-stroke-emphasis)]">
            <div className="mb-1 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--term-ink-tertiary)]">
              Visible columns
            </div>
            {orderedColumns.map((col, i) => {
              const isHidden = hiddenColumns.includes(col.key);
              return (
                <div key={col.key} className="flex items-center justify-between px-3 py-1.5 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => onToggleColumn(col.key)}
                    className={cn(
                      "flex items-center gap-2",
                      isHidden ? "text-[var(--term-ink-tertiary)]" : "text-[var(--term-ink)]"
                    )}
                  >
                    {isHidden ? <span className="inline-block w-[11px]" /> : <Check size={11} className="text-[var(--term-amber)]" />}
                    {col.header}
                  </button>
                  <span className="flex items-center gap-0.5 text-[var(--term-ink-tertiary)]">
                    <button
                      type="button"
                      aria-label={`Move ${col.header} left`}
                      disabled={i === 0}
                      onClick={() => onMoveColumn(col.key, -1)}
                      className="p-0.5 hover:text-[var(--term-ink)] disabled:opacity-30"
                    >
                      <ArrowUp size={11} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${col.header} right`}
                      disabled={i === orderedColumns.length - 1}
                      onClick={() => onMoveColumn(col.key, 1)}
                      className="p-0.5 hover:text-[var(--term-ink)] disabled:opacity-30"
                    >
                      <ArrowDown size={11} />
                    </button>
                  </span>
                </div>
              );
            })}
            <div className="mt-1.5 border-t border-[var(--term-hairline)] px-3 pt-1.5">
              <button
                type="button"
                onClick={onResetColumns}
                className="py-1.5 font-mono text-[11px] text-[var(--term-ink-secondary)] hover:text-[var(--term-ink)]"
              >
                Reset to default
              </button>
            </div>
          </div>
        )}
      </div>

      <ToolbarButton
        active={density === "comfortable"}
        onClick={() => onDensityChange(density === "compact" ? "comfortable" : "compact")}
        icon={density === "compact" ? <LayoutList size={12} /> : <Rows3 size={12} />}
        label={density === "compact" ? "Compact" : "Comfort"}
        title="Toggle row density"
      />

      <ToolbarButton
        active={showHighlights}
        onClick={onToggleHighlights}
        icon={<Sparkles size={12} />}
        label="Highlights"
        title="Toggle Most Volatile / Biggest IV Gap / Largest Cap strip"
      />

      <ToolbarButton
        active={showSentiment}
        onClick={onToggleSentiment}
        icon={<Gauge size={12} />}
        label="Sentiment"
        title="Toggle market sentiment (Fear/Greed) strip"
      />

      <ToolbarButton active={false} onClick={onExport} icon={<Download size={12} />} label="Export" title="Export visible rows to CSV" />

      {compareCount > 0 && (
        <ToolbarButton active onClick={onOpenCompare} icon={<LayoutList size={12} />} label={`Compare (${compareCount})`} />
      )}

      <div className="flex-1" />
      {rightSlot}
    </div>
  );
}
