"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Star, TriangleAlert } from "lucide-react";
import { cn, formatLarge, formatPct, formatPrice } from "@/lib/utils";
import { DEFAULT_ROW_HEIGHT, PINNED_COLUMN_WIDTH } from "@/lib/market/columns";
import type { ColumnDef, Density, EnrichedCompany } from "@/lib/market/types";

export interface SortState {
  key: string | null;
  direction: "asc" | "desc" | null;
}

export interface ExplorerTableProps {
  rows: EnrichedCompany[];
  columns: ColumnDef[];
  density: Density;
  sort: SortState;
  onSort: (key: string) => void;
  selectedTickers: Set<string>;
  onToggleSelect: (ticker: string) => void;
  watchedTickers: Set<string>;
  onToggleWatch: (ticker: string) => void;
  onActivateRow: (ticker: string) => void;
  changedTickers: Set<string>;
}

function ChangeBar({ value, cap = 6 }: { value: number; cap?: number }) {
  const pct = Math.min(Math.abs(value) / cap, 1) * 100;
  const positive = value >= 0;
  return (
    <div className="relative h-1 w-12 rounded-full bg-bg-tertiary overflow-hidden">
      <div
        className={cn("absolute inset-y-0 rounded-full", positive ? "left-1/2 bg-positive" : "right-1/2 bg-negative")}
        style={{ width: `${pct / 2}%` }}
      />
      <div className="absolute inset-y-0 left-1/2 w-px bg-border-light" />
    </div>
  );
}

function CellContent({ col, row }: { col: ColumnDef; row: EnrichedCompany }) {
  switch (col.key) {
    case "industry":
      return <span className="truncate text-text-secondary">{row.industry_name}</span>;
    case "price":
      return <span className="num block text-right">{formatPrice(row.current_price)}</span>;
    case "prevClose":
      return <span className="num block text-right text-text-secondary">{formatPrice(row.prev_close)}</span>;
    case "dayChange": {
      if (row.day_change_pct == null) return <span className="num block text-right text-text-tertiary">N/A</span>;
      const v = Number(row.day_change_pct);
      const positive = v >= 0;
      return (
        <div className="flex items-center justify-end gap-2">
          <ChangeBar value={v} />
          <span className={cn("num flex items-center gap-0.5", positive ? "text-positive" : "text-negative")}>
            {positive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {formatPct(v)}
          </span>
        </div>
      );
    }
    case "ivGap": {
      if (row.ivGapPct == null) return <span className="num block text-right text-text-tertiary">N/A</span>;
      const v = row.ivGapPct;
      return (
        <span className={cn("num block text-right", v > 0 ? "text-negative" : v < 0 ? "text-positive" : "text-neutral")}>
          {formatPct(v)}
        </span>
      );
    }
    case "marketCap":
      return <span className="num block text-right">{formatLarge(row.market_cap)}</span>;
    case "volatility":
      return <span className="num block text-right text-text-secondary">{row.volatility == null ? "N/A" : formatPct(Number(row.volatility))}</span>;
    default:
      return null;
  }
}

interface RowProps {
  row: EnrichedCompany;
  columns: ColumnDef[];
  rowHeight: number;
  top: number;
  focused: boolean;
  selected: boolean;
  watched: boolean;
  changed: boolean;
  onActivate: () => void;
  onToggleSelect: () => void;
  onToggleWatch: () => void;
  scrolledX: boolean;
}

const ExplorerRow = React.memo(function ExplorerRow({
  row,
  columns,
  rowHeight,
  top,
  focused,
  selected,
  watched,
  changed,
  onActivate,
  onToggleSelect,
  onToggleWatch,
  scrolledX,
}: RowProps) {
  return (
    <div
      role="row"
      aria-selected={selected}
      data-row-ticker={row.ticker}
      className={cn(
        "group absolute left-0 right-0 flex items-stretch border-b border-border/60 cursor-pointer transition-colors",
        selected ? "bg-bg-tertiary" : "hover:bg-bg-hover",
        focused && "ring-1 ring-inset ring-accent-dim"
      )}
      style={{ height: rowHeight, top }}
      onClick={onActivate}
    >
      <div
        className={cn(
          "sticky left-0 z-10 flex items-center gap-1.5 pl-1.5 pr-2",
          selected ? "bg-bg-tertiary" : "bg-bg-primary group-hover:bg-bg-hover"
        )}
        style={{ width: PINNED_COLUMN_WIDTH, minWidth: PINNED_COLUMN_WIDTH }}
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 w-0.5",
            selected ? "bg-accent" : "bg-transparent"
          )}
        />
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={selected ? `Remove ${row.ticker} from compare` : `Add ${row.ticker} to compare`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className={cn(
            "h-3.5 w-3.5 shrink-0 rounded-[3px] border transition-opacity",
            selected ? "border-accent bg-accent opacity-100" : "border-border-light opacity-0 group-hover:opacity-100",
            "flex items-center justify-center"
          )}
        >
          {selected && <span className="h-1.5 w-1.5 rounded-[1px] bg-white" />}
        </button>
        <button
          type="button"
          aria-label={watched ? `Remove ${row.ticker} from watchlist` : `Add ${row.ticker} to watchlist`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatch();
          }}
          className={cn(
            "shrink-0 transition-opacity",
            watched ? "text-warning opacity-100" : "text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-warning"
          )}
        >
          <Star size={12} fill={watched ? "currentColor" : "none"} />
        </button>
        <div className="min-w-0 flex-1">
          <div className={cn("num truncate text-body font-bold uppercase", changed && "cell-flash")}>{row.ticker}</div>
          <div className="truncate text-micro text-text-tertiary leading-tight">{row.name}</div>
        </div>
        {scrolledX && (
          <div className="pointer-events-none absolute inset-y-0 -right-3 w-3 bg-gradient-to-r from-black/25 to-transparent" />
        )}
      </div>
      {columns.map((col) => (
        <div
          key={col.key}
          className={cn("flex items-center px-3 text-body", changed && (col.key === "price" || col.key === "dayChange") && "cell-flash")}
          style={{ width: col.width, minWidth: col.width }}
        >
          <div className="w-full">
            <CellContent col={col} row={row} />
          </div>
        </div>
      ))}
    </div>
  );
});

export function ExplorerTable({
  rows,
  columns,
  density,
  sort,
  onSort,
  selectedTickers,
  onToggleSelect,
  watchedTickers,
  onToggleWatch,
  onActivateRow,
  changedTickers,
}: ExplorerTableProps) {
  const rowHeight = DEFAULT_ROW_HEIGHT[density];
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [scrolledX, setScrolledX] = React.useState(false);
  const [containerHeight, setContainerHeight] = React.useState(600);
  const [focusedIndex, setFocusedIndex] = React.useState(0);

  React.useEffect(() => {
    setFocusedIndex((i) => Math.min(i, Math.max(rows.length - 1, 0)));
  }, [rows.length]);

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
    setScrolledX(e.currentTarget.scrollLeft > 0);
  }

  const totalRows = rows.length;
  const overscan = 6;
  const visibleStart = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / rowHeight) + overscan * 2;
  const visibleEnd = Math.min(totalRows, visibleStart + visibleCount);
  const topPadding = visibleStart * rowHeight;
  const bottomPadding = (totalRows - visibleEnd) * rowHeight;

  function scrollToIndex(index: number) {
    const el = containerRef.current;
    if (!el) return;
    const top = index * rowHeight;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + rowHeight > el.scrollTop + containerHeight) el.scrollTop = top + rowHeight - containerHeight;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (totalRows === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => {
        const next = Math.min(i + 1, totalRows - 1);
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => {
        const next = Math.max(i - 1, 0);
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[focusedIndex];
      if (row) onActivateRow(row.ticker);
    } else if (e.key === " ") {
      e.preventDefault();
      const row = rows[focusedIndex];
      if (row) onToggleSelect(row.ticker);
    } else if (e.key.toLowerCase() === "w") {
      e.preventDefault();
      const row = rows[focusedIndex];
      if (row) onToggleWatch(row.ticker);
    }
  }

  const totalWidth = PINNED_COLUMN_WIDTH + columns.reduce((sum, c) => sum + c.width, 0);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="grid"
      aria-label="Market screener results"
      className="relative h-full flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent-dim"
    >
      <div style={{ minWidth: totalWidth }}>
        <div className="sticky top-0 z-20 flex border-b border-border bg-bg-secondary" role="row">
          <button
            type="button"
            onClick={() => onSort("ticker")}
            className="sticky left-0 z-30 flex items-center gap-1 bg-bg-secondary pl-8 pr-2 text-micro font-medium uppercase text-text-secondary hover:text-text-primary transition-colors"
            style={{ width: PINNED_COLUMN_WIDTH, minWidth: PINNED_COLUMN_WIDTH, height: 32 }}
          >
            Company
            {sort.key === "ticker" && sort.direction === "asc" && <ArrowUp size={11} className="text-accent" />}
            {sort.key === "ticker" && sort.direction === "desc" && <ArrowDown size={11} className="text-accent" />}
            {scrolledX && (
              <div className="pointer-events-none absolute inset-y-0 -right-3 w-3 bg-gradient-to-r from-black/25 to-transparent" />
            )}
          </button>
          {columns.map((col) => {
            const isSorted = sort.key === col.key;
            return (
              <button
                key={col.key}
                type="button"
                onClick={() => onSort(col.key)}
                className={cn(
                  "flex items-center gap-1 px-3 text-micro font-medium uppercase text-text-secondary hover:text-text-primary transition-colors",
                  col.align === "right" && "justify-end text-right"
                )}
                style={{ width: col.width, minWidth: col.width, height: 32 }}
              >
                <span>{col.header}</span>
                {isSorted && sort.direction === "asc" && <ArrowUp size={11} className="text-accent" />}
                {isSorted && sort.direction === "desc" && <ArrowDown size={11} className="text-accent" />}
              </button>
            );
          })}
        </div>

        <div style={{ height: topPadding }} />
        <div style={{ position: "relative", height: (visibleEnd - visibleStart) * rowHeight }}>
          {rows.slice(visibleStart, visibleEnd).map((row, i) => {
            const idx = visibleStart + i;
            return (
              <ExplorerRow
                key={row.ticker}
                row={row}
                columns={columns}
                rowHeight={rowHeight}
                top={i * rowHeight}
                focused={idx === focusedIndex}
                selected={selectedTickers.has(row.ticker)}
                watched={watchedTickers.has(row.ticker)}
                changed={changedTickers.has(row.ticker)}
                onActivate={() => {
                  setFocusedIndex(idx);
                  onActivateRow(row.ticker);
                }}
                onToggleSelect={() => onToggleSelect(row.ticker)}
                onToggleWatch={() => onToggleWatch(row.ticker)}
                scrolledX={scrolledX}
              />
            );
          })}
        </div>
        <div style={{ height: bottomPadding }} />

        {totalRows > 0 && totalRows < 8 && (
          <div className="flex items-center gap-2 px-3 py-6 text-micro text-text-tertiary">
            <TriangleAlert size={12} />
            Narrow result set — loosen filters for a fuller screen.
          </div>
        )}
      </div>
    </div>
  );
}
