"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronRight, Minus, Star, TriangleAlert } from "lucide-react";
import { cn, formatLarge, formatPct, formatPrice } from "@/lib/utils";
import { DEFAULT_ROW_HEIGHT, PINNED_COLUMN_WIDTH } from "@/lib/market/columns";
import { RowExpandedContent } from "@/components/market/RowExpandedContent";
import type { ColumnDef, Density, EnrichedCompany, SortEntry } from "@/lib/market/types";

export interface SortState {
  key: string | null;
  direction: "asc" | "desc" | null;
  secondary?: SortEntry | null;
}

export interface ExplorerTableProps {
  rows: EnrichedCompany[];
  columns: ColumnDef[];
  density: Density;
  sort: SortState;
  onSort: (key: string, shiftKey?: boolean) => void;
  selectedTickers: Set<string>;
  onToggleSelect: (ticker: string) => void;
  watchedTickers: Set<string>;
  onToggleWatch: (ticker: string) => void;
  onActivateRow: (ticker: string) => void;
  changedTickers: Set<string>;
  onColumnResize?: (key: string, width: number) => void;
}

function ChangeBar({ value, cap = 5 }: { value: number; cap?: number }) {
  const normalized = Math.min(Math.abs(value) / cap, 1);
  const pct = normalized * 50;
  const positive = value >= 0;
  return (
    <div className="relative h-[3px] w-10 rounded-full bg-border/50 overflow-hidden">
      <div
        className={cn(
          "absolute inset-y-0 rounded-full transition-all duration-300",
          positive ? "left-1/2 bg-positive" : "right-1/2 bg-negative"
        )}
        style={{ width: `${pct}%` }}
      />
      <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
    </div>
  );
}

function HeatBar({ value, min, max }: { value: number; min: number; max: number }) {
  if (max === min) return null;
  const normalized = (value - min) / (max - min);
  const opacity = 0.06 + normalized * 0.18;
  return (
    <div
      className="absolute inset-y-0 left-0 right-0 pointer-events-none bg-accent"
      style={{ opacity }}
    />
  );
}

function MarketCapBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    Mega: "bg-accent/15 text-accent",
    Large: "bg-blue-500/10 text-blue-400",
    Mid: "bg-purple-500/10 text-purple-400",
    Small: "bg-amber-500/10 text-amber-400",
    Micro: "bg-orange-500/10 text-orange-400",
    Unknown: "bg-border/30 text-text-tertiary",
  };
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-micro font-medium", colors[category] ?? colors.Unknown)}>
      {category}
    </span>
  );
}

function CellContent({ col, row, minMax }: { col: ColumnDef; row: EnrichedCompany; minMax?: { price?: { min: number; max: number }; mktCap?: { min: number; max: number } } }) {
  switch (col.key) {
    case "industry":
      return <span className="truncate text-text-secondary text-small">{row.industry_name}</span>;
    case "price":
      return <span className="num block text-right font-medium text-small">{formatPrice(row.current_price)}</span>;
    case "prevClose":
      return <span className="num block text-right text-text-secondary text-small">{row.prev_close != null ? formatPrice(row.prev_close) : "—"}</span>;
    case "dayChange": {
      if (row.day_change_pct == null) return <span className="num block text-right text-text-tertiary">—</span>;
      const v = Number(row.day_change_pct);
      const positive = v >= 0;
      const absV = Math.abs(v);
      const intensity = Math.min(absV / 5, 1);
      return (
        <div className="flex items-center justify-end gap-1.5">
          <ChangeBar value={v} />
          <span
            className={cn(
              "num flex items-center gap-0.5 text-small font-medium tabular-nums",
              positive ? "text-positive" : "text-negative"
            )}
            style={{ opacity: 0.5 + intensity * 0.5 }}
          >
            {absV < 0.01 ? <Minus size={9} /> : positive ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
            {formatPct(v)}
          </span>
        </div>
      );
    }
    case "ivGap": {
      if (row.ivGapPct == null) return <span className="num block text-right text-text-tertiary">—</span>;
      const v = row.ivGapPct;
      const absV = Math.abs(v);
      const intensity = Math.min(absV / 10, 1);
      const cls = v < -3 ? "text-positive" : v > 3 ? "text-negative" : "text-text-secondary";
      return (
        <span
          className={cn("num block text-right text-small tabular-nums", cls)}
          style={{ opacity: 0.5 + intensity * 0.5 }}
        >
          {formatPct(v)}
        </span>
      );
    }
    case "iv": {
      if (row.intrinsic_value == null) return <span className="num block text-right text-text-tertiary">—</span>;
      return <span className="num block text-right text-text-secondary text-small tabular-nums">{formatPrice(row.intrinsic_value)}</span>;
    }
    case "marketCap":
      return <span className="num block text-right text-small tabular-nums">{formatLarge(row.market_cap)}</span>;
    case "marketCapCategory":
      return <MarketCapBadge category={row.marketCapCategory} />;
    case "volatility":
      return <span className="num block text-right text-small tabular-nums">{row.volatility == null ? "—" : formatPct(Number(row.volatility))}</span>;
    case "volume":
      return <span className="num block text-right text-small tabular-nums">{row.avg_volume_20d == null ? "—" : `Avg ${formatLarge(row.avg_volume_20d)}`}</span>;
    case "high52w":
      return <span className="num block text-right text-small tabular-nums">{row.high_52w == null ? "—" : formatPrice(row.high_52w)}</span>;
    case "low52w":
      return <span className="num block text-right text-small tabular-nums">{row.low_52w == null ? "—" : formatPrice(row.low_52w)}</span>;
    case "pctOffHigh": {
      if (row.pctOffHigh == null) return <span className="num block text-right text-text-tertiary">—</span>;
      const v = Number(row.pctOffHigh);
      const absV = Math.abs(v);
      const intensity = Math.min(absV / 10, 1);
      return (
        <span
          className="num block text-right text-negative text-small tabular-nums"
          style={{ opacity: 0.5 + intensity * 0.5 }}
        >
          {formatPct(v)}
        </span>
      );
    }
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
  rank: number;
  isExpanded: boolean;
  onActivate: () => void;
  onToggleSelect: () => void;
  onToggleWatch: () => void;
  onExpand: () => void;
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
  rank,
  isExpanded,
  onActivate,
  onToggleSelect,
  onToggleWatch,
  onExpand,
  scrolledX,
}: RowProps) {
  return (
    <div
      role="row"
      aria-selected={selected}
      data-row-ticker={row.ticker}
      className={cn(
        "group absolute left-0 right-0 flex items-stretch border-b border-border/40 cursor-pointer",
        "transition-[background-color,border-color] duration-150",
        "hover:border-l-2 hover:border-l-accent/60",
        selected ? "bg-accent/8 border-l-2 border-l-accent" : focused ? "bg-bg-hover border-l-2 border-l-accent/30" : "bg-transparent",
      )}
      style={{ height: rowHeight, top }}
      onClick={onActivate}
    >
      <div
        className={cn(
          "sticky left-0 z-10 flex items-center gap-0.5 pl-0.5 pr-1.5",
          selected ? "bg-accent/8" : "bg-bg-primary group-hover:bg-bg-hover"
        )}
        style={{ width: PINNED_COLUMN_WIDTH, minWidth: PINNED_COLUMN_WIDTH }}
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 w-[2px] transition-colors",
            selected ? "bg-accent" : watched ? "bg-warning/50" : "bg-transparent"
          )}
        />
        <button
          type="button"
          aria-label={isExpanded ? `Collapse ${row.ticker} details` : `Expand ${row.ticker} details`}
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className={cn(
            "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm transition-all",
            isExpanded
              ? "text-accent opacity-100"
              : "text-text-tertiary opacity-0 group-hover:opacity-60 hover:!opacity-100"
          )}
        >
          <ChevronRight size={10} className={cn("transition-transform duration-150", isExpanded && "rotate-90")} />
        </button>
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
            "h-3 w-3 shrink-0 rounded-sm border transition-all",
            selected ? "border-accent bg-accent" : "border-border-light opacity-0 group-hover:opacity-60 hover:!opacity-100",
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
            "shrink-0 transition-all",
            watched ? "text-warning opacity-100" : "text-text-tertiary opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-warning"
          )}
        >
          <Star size={11} fill={watched ? "currentColor" : "none"} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            <span className="text-micro text-text-tertiary tabular-nums w-4 shrink-0 text-right">
              {rank}
            </span>
            <span className={cn("num truncate font-bold uppercase tracking-tight text-small", changed && "cell-flash")}>
              {row.ticker}
            </span>
          </div>
          <div className="truncate text-micro text-text-tertiary leading-tight max-w-[140px]">{row.name}</div>
        </div>
        {scrolledX && (
          <div className="pointer-events-none absolute inset-y-0 -right-3 w-3 bg-gradient-to-r from-black/20 to-transparent" />
        )}
      </div>
      {columns.map((col) => (
        <div
          key={col.key}
          className={cn(
            "relative flex items-center px-2.5",
            changed && (col.key === "price" || col.key === "dayChange") && "cell-flash"
          )}
          style={{ width: col.width, minWidth: col.width }}
        >
          <div className="relative z-10 w-full">
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
  onColumnResize,
}: ExplorerTableProps) {
  const rowHeight = DEFAULT_ROW_HEIGHT[density];
  const EXPANDED_HEIGHT = 120;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [scrolledX, setScrolledX] = React.useState(false);
  const [containerHeight, setContainerHeight] = React.useState(600);
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const [expandedTicker, setExpandedTicker] = React.useState<string | null>(null);
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const col of columns) initial[col.key] = col.width;
    return initial;
  });
  const resizingRef = React.useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  function handleColumnResizeStart(key: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidths[key] ?? columns.find((c) => c.key === key)?.width ?? 80;
    resizingRef.current = { key, startX: e.clientX, startWidth };

    function onMouseMove(ev: MouseEvent) {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(50, resizingRef.current.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizingRef.current!.key]: newWidth }));
    }

    function onMouseUp() {
      if (resizingRef.current) {
        onColumnResize?.(resizingRef.current.key, columnWidths[resizingRef.current.key] ?? 80);
      }
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  const resolvedColumns = React.useMemo(
    () => columns.map((c) => ({ ...c, width: columnWidths[c.key] ?? c.width })),
    [columns, columnWidths]
  );

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

  const expandedIdx = expandedTicker ? rows.findIndex((r) => r.ticker === expandedTicker) : -1;

  function getRowTop(idx: number): number {
    let top = idx * rowHeight;
    if (expandedIdx >= 0 && idx > expandedIdx) {
      top += EXPANDED_HEIGHT;
    }
    return top;
  }

  const totalRows = rows.length;
  const overscan = 8;
  const visibleStart = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / rowHeight) + overscan * 2;
  const visibleEnd = Math.min(totalRows, visibleStart + visibleCount);

  let topPadding = visibleStart * rowHeight;
  if (expandedIdx >= 0 && expandedIdx < visibleStart) {
    topPadding += EXPANDED_HEIGHT;
  }
  let bottomPadding = (totalRows - visibleEnd) * rowHeight;
  if (expandedIdx >= 0 && expandedIdx >= visibleEnd) {
    bottomPadding += EXPANDED_HEIGHT;
  }

  function scrollToIndex(index: number) {
    const el = containerRef.current;
    if (!el) return;
    const top = getRowTop(index);
    const bottom = top + rowHeight + (index === expandedIdx ? EXPANDED_HEIGHT : 0);
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + containerHeight) el.scrollTop = bottom - containerHeight;
  }

  function toggleExpand(ticker: string) {
    setExpandedTicker((prev) => (prev === ticker ? null : ticker));
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
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const row = rows[focusedIndex];
      if (row) toggleExpand(row.ticker);
    }
  }

  const totalWidth = PINNED_COLUMN_WIDTH + resolvedColumns.reduce((sum, c) => sum + c.width, 0);

  function sortPriority(key: string): number | null {
    if (sort.key === key) return 1;
    if (sort.secondary?.key === key) return 2;
    return null;
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="grid"
      aria-label="Market screener results"
      className="relative h-full flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent/30"
    >
      <div style={{ minWidth: totalWidth }}>
        {/* Header */}
        <div className="sticky top-0 z-20 flex border-b border-border bg-bg-secondary/95 backdrop-blur-sm" role="row">
          <button
            type="button"
            onClick={() => onSort("ticker")}
            className="sticky left-0 z-30 flex items-center gap-1 bg-bg-secondary pl-7 pr-2 text-micro font-semibold uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors"
            style={{ width: PINNED_COLUMN_WIDTH, minWidth: PINNED_COLUMN_WIDTH, height: 30 }}
          >
            Company
            {sort.key === "ticker" && (
              <span className="text-accent">{sort.direction === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />}</span>
            )}
          </button>
          {resolvedColumns.map((col, colIdx) => {
            const priority = sortPriority(col.key);
            const isSorted = priority !== null;
            return (
              <div key={col.key} className="relative flex" style={{ width: col.width, minWidth: col.width }}>
                <button
                  type="button"
                  onClick={(e) => onSort(col.key, e.shiftKey)}
                  className={cn(
                    "flex flex-1 items-center gap-1 px-2.5 text-micro font-semibold uppercase tracking-wider transition-colors",
                    isSorted ? "text-accent" : "text-text-secondary hover:text-text-primary",
                    col.align === "right" && "justify-end text-right"
                  )}
                  style={{ height: 30 }}
                >
                  <span>{col.header}</span>
                  {isSorted && (
                    <>
                      <span className="inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-[3px] bg-accent/20 px-0.5 text-[8px] font-bold text-accent tabular-nums">
                        {priority}
                      </span>
                      <span className="text-accent">
                        {priority === 1
                          ? (sort.direction === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)
                          : (sort.secondary?.direction === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                      </span>
                    </>
                  )}
                </button>
                {colIdx < resolvedColumns.length - 1 && (
                  <div
                    role="separator"
                    aria-label={`Resize ${col.header} column`}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize group/resize hover:bg-accent/30 transition-colors z-10"
                    onMouseDown={(e) => handleColumnResizeStart(col.key, e)}
                  >
                    <div className="absolute right-0 top-1 bottom-1 w-px bg-border/0 group-hover/resize:bg-accent/50 transition-colors" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Virtualized rows */}
        <div style={{ height: topPadding }} />
        <div style={{ position: "relative", height: (visibleEnd - visibleStart) * rowHeight + (expandedIdx >= visibleStart && expandedIdx < visibleEnd ? EXPANDED_HEIGHT : 0) }}>
          {rows.slice(visibleStart, visibleEnd).map((row, i) => {
            const idx = visibleStart + i;
            return (
              <React.Fragment key={row.ticker}>
                <ExplorerRow
                  row={row}
                  columns={resolvedColumns}
                  rowHeight={rowHeight}
                  top={getRowTop(idx)}
                  focused={idx === focusedIndex}
                  selected={selectedTickers.has(row.ticker)}
                  watched={watchedTickers.has(row.ticker)}
                  changed={changedTickers.has(row.ticker)}
                  rank={idx + 1}
                  isExpanded={idx === expandedIdx}
                  onActivate={() => {
                    setFocusedIndex(idx);
                    onActivateRow(row.ticker);
                  }}
                  onToggleSelect={() => onToggleSelect(row.ticker)}
                  onToggleWatch={() => onToggleWatch(row.ticker)}
                  onExpand={() => toggleExpand(row.ticker)}
                  scrolledX={scrolledX}
                />
                {idx === expandedIdx && (
                  <div
                    className="absolute left-0 right-0 overflow-hidden"
                    style={{ top: getRowTop(idx) + rowHeight, height: EXPANDED_HEIGHT }}
                  >
                    <RowExpandedContent row={row} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ height: bottomPadding }} />

        {/* Footer hints */}
        {totalRows > 0 && totalRows < 10 && (
          <div className="flex items-center gap-2 px-3 py-4 text-micro text-text-tertiary">
            <TriangleAlert size={11} />
            Narrow result set — loosen filters for more results.
          </div>
        )}
      </div>
    </div>
  );
}
