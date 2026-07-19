"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronRight, TriangleAlert } from "lucide-react";
import { cn, formatLarge, formatPct, formatPrice } from "@/lib/utils";
import { DEFAULT_ROW_HEIGHT, PINNED_COLUMN_WIDTH } from "@/lib/market/columns";
import { sectorCode } from "@/lib/market/sectorAbbrev";
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
  onSectorClick?: (industryName: string) => void;
}

// Cap class is categorical, low-urgency metadata, not a signal — it doesn't
// earn a hue. A monochrome tick whose height encodes tier order (ordinal,
// honest) replaces the previous blue/purple/orange/amber rainbow.
const CAP_TIERS: Record<string, number> = { Mega: 4, Large: 3, Mid: 2, Small: 1, Micro: 0 };

function MarketCapBadge({ category }: { category: string }) {
  const tier = CAP_TIERS[category];
  return (
    <span className="inline-flex items-center gap-1.5 text-micro text-[color:var(--term-ink-secondary)]">
      {tier != null && (
        <span aria-hidden className="inline-block w-[3px] rounded-full bg-[color:var(--term-ink-tertiary)]" style={{ height: 6 + tier * 2 }} />
      )}
      {category}
    </span>
  );
}

/** Two real data points (prev close -> current), not a fabricated intraday
 * series — this sim has exactly one price per day, so that's the only
 * honest "spark" available per row without an extra per-company fetch. */
function Spark({ prevClose, current, dim }: { prevClose: number | null; current: number | null; dim?: boolean }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const width = 72;
  const height = 18;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prevClose == null || current == null || prevClose <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const up = current >= prevClose;
    const min = Math.min(prevClose, current);
    const max = Math.max(prevClose, current);
    const range = max - min || 1;
    const y0 = height - ((prevClose - min) / range) * (height - 4) - 2;
    const y1 = height - ((current - min) / range) * (height - 4) - 2;

    ctx.strokeStyle = up ? "#3fbf85" : "#e85d68";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, y0);
    ctx.lineTo(width - 4, y1);
    ctx.stroke();

    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(width - 4, y1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }, [prevClose, current]);

  if (prevClose == null || current == null) return <span className="text-[color:var(--term-ink-tertiary)]">—</span>;
  return <canvas ref={canvasRef} style={{ width, height, display: "block", opacity: dim ? 0.5 : 1 }} className="ml-auto transition-opacity" />;
}

const OUTLIER_THRESHOLD = 15;

function CellContent({
  col,
  row,
  onSectorClick,
  sparkDim,
}: {
  col: ColumnDef;
  row: EnrichedCompany;
  onSectorClick?: (industryName: string) => void;
  sparkDim?: boolean;
}) {
  switch (col.key) {
    case "industry":
      return (
        <button
          type="button"
          title={row.industry_name}
          onClick={(e) => {
            e.stopPropagation();
            onSectorClick?.(row.industry_name);
          }}
          className="truncate text-left text-small text-[color:var(--term-ink-tertiary)] hover:text-[color:var(--term-accent)]"
        >
          {sectorCode(row.industry_name)}
        </button>
      );
    case "price":
      return <span className="num block text-right font-medium text-small text-[color:var(--term-ink)]">{formatPrice(row.current_price)}</span>;
    case "prevClose":
      return <span className="num block text-right text-small text-[color:var(--term-ink-secondary)]">{row.prev_close != null ? formatPrice(row.prev_close) : "—"}</span>;
    case "dayChange": {
      if (row.day_change_pct == null) return <span className="num block text-right text-[color:var(--term-ink-tertiary)]">—</span>;
      const v = Number(row.day_change_pct);
      const positive = v >= 0;
      const isOutlier = Math.abs(v) >= OUTLIER_THRESHOLD;
      return (
        <span
          className={cn(
            "num flex items-center justify-end gap-0.5 text-small tabular-nums",
            isOutlier && "font-bold",
            positive ? "text-[color:var(--term-up)]" : "text-[color:var(--term-down)]"
          )}
        >
          {positive ? "▲" : "▼"}
          {formatPct(v)}
          {isOutlier && "⚡"}
        </span>
      );
    }
    case "dayChangeAbs": {
      if (row.day_change_pct == null || row.current_price == null) return <span className="num block text-right text-[color:var(--term-ink-tertiary)]">—</span>;
      const cur = Number(row.current_price);
      const pct = Number(row.day_change_pct);
      const abs = cur - cur / (1 + pct / 100);
      const positive = abs >= 0;
      return (
        <span className={cn("num block text-right text-small tabular-nums", positive ? "text-[color:var(--term-up)]" : "text-[color:var(--term-down)]")}>
          {formatPrice(abs)}
        </span>
      );
    }
    case "ivGap": {
      // IV Gap is a valuation distance (how far price sits from intrinsic
      // value), not a directional move like Day Chg — coloring it market
      // red/green off its sign reads as a false "up/down" signal and
      // collides with the real Day Chg color right next to it.
      if (row.ivGapPct == null) return <span className="num block text-right text-[color:var(--term-ink-tertiary)]">—</span>;
      return <span className="num block text-right text-small tabular-nums text-[color:var(--term-ink-secondary)]">{formatPct(row.ivGapPct)}</span>;
    }
    case "iv": {
      if (row.intrinsic_value == null) return <span className="num block text-right text-[color:var(--term-ink-tertiary)]">—</span>;
      return <span className="num block text-right text-[color:var(--term-ink-secondary)] text-small tabular-nums">{formatPrice(row.intrinsic_value)}</span>;
    }
    case "marketCap":
      return <span className="num block text-right text-small tabular-nums text-[color:var(--term-ink)]">{formatLarge(row.market_cap)}</span>;
    case "spark":
      return <Spark prevClose={row.prev_close != null ? Number(row.prev_close) : null} current={row.current_price != null ? Number(row.current_price) : null} dim={sparkDim} />;
    case "marketCapCategory":
      return <MarketCapBadge category={row.marketCapCategory} />;
    case "volatility":
      return <span className="num block text-right text-small tabular-nums text-[color:var(--term-ink-secondary)]">{row.volatility == null ? "—" : formatPct(Number(row.volatility))}</span>;
    case "volume":
      return <span className="num block text-right text-small tabular-nums text-[color:var(--term-ink-secondary)]">{row.avg_volume_20d == null ? "—" : `Avg ${formatLarge(row.avg_volume_20d)}`}</span>;
    case "high52w":
      return <span className="num block text-right text-small tabular-nums text-[color:var(--term-ink-secondary)]">{row.high_52w == null ? "—" : formatPrice(row.high_52w)}</span>;
    case "low52w":
      return <span className="num block text-right text-small tabular-nums text-[color:var(--term-ink-secondary)]">{row.low_52w == null ? "—" : formatPrice(row.low_52w)}</span>;
    case "pctOffHigh": {
      if (row.pctOffHigh == null) return <span className="num block text-right text-[color:var(--term-ink-tertiary)]">—</span>;
      return <span className="num block text-right text-small tabular-nums text-[color:var(--term-down)]">{formatPct(Number(row.pctOffHigh))}</span>;
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
  onExpand: () => void;
  onSectorClick?: (industryName: string) => void;
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
  onExpand,
  onSectorClick,
  scrolledX,
}: RowProps) {
  const isTerminalDensity = rowHeight <= 24;
  const isLedgerLine = (rank % 5 === 0) && !isExpanded;

  return (
    <div
      role="row"
      aria-selected={selected}
      data-row-ticker={row.ticker}
      className={cn(
        "group absolute left-0 right-0 flex items-stretch cursor-pointer",
        isLedgerLine ? "border-b border-[var(--term-divider)]" : "border-b border-[var(--term-hairline)]",
        !isTerminalDensity && "hover:bg-white/[0.03]",
        focused && "bg-white/[0.04]",
        selected && "bg-[color:var(--term-accent)]/10"
      )}
      style={{ height: rowHeight, top }}
      onClick={onActivate}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-[2px]",
          focused || selected ? "bg-[color:var(--term-accent)]" : "bg-transparent"
        )}
      />
      <div
        className="sticky left-0 z-10 flex items-center gap-1 bg-[var(--term-bg)] pl-2 pr-1.5"
        style={{ width: PINNED_COLUMN_WIDTH, minWidth: PINNED_COLUMN_WIDTH }}
      >
        <button
          type="button"
          aria-label={isExpanded ? `Collapse ${row.ticker} details` : `Expand ${row.ticker} details`}
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className={cn(
            "flex h-3.5 w-3.5 shrink-0 items-center justify-center transition-all",
            isExpanded
              ? "text-[color:var(--term-accent)] opacity-100"
              : "text-[color:var(--term-ink-tertiary)] opacity-0 group-hover:opacity-60 hover:!opacity-100"
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
            "h-3 w-3 shrink-0 border transition-all flex items-center justify-center",
            selected ? "border-[color:var(--term-accent)] bg-[color:var(--term-accent)]" : "border-[color:var(--term-ink-tertiary)] opacity-0 group-hover:opacity-60 hover:!opacity-100"
          )}
        >
          {selected && <span className="h-1.5 w-1.5 bg-white" />}
        </button>
        <span className={cn("num shrink-0 font-mono text-small font-semibold text-[color:var(--term-ink)]", changed && "cell-flash")} style={{ width: "6ch" }}>
          {row.ticker}
          {watched && <span className="text-[color:var(--term-amber)]"> ✓</span>}
        </span>
        <span className="truncate text-small text-[color:var(--term-ink-secondary)]" style={{ fontFamily: "var(--font-sans)" }}>
          {row.name}
        </span>
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
            <CellContent col={col} row={row} onSectorClick={onSectorClick} sparkDim={isTerminalDensity && !focused} />
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
  onSectorClick,
}: ExplorerTableProps) {
  const rowHeight = DEFAULT_ROW_HEIGHT[density];
  const EXPANDED_HEIGHT = 120;
  const PAGE_SIZE = 50;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [scrolledX, setScrolledX] = React.useState(false);
  const [containerHeight, setContainerHeight] = React.useState(600);
  const [currentPage, setCurrentPage] = React.useState(1);
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

  // Reset to page 1 if the overall rows length changes (e.g. filters change)
  React.useEffect(() => {
    setCurrentPage(1);
    setFocusedIndex(0);
  }, [rows.length]);

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);

  const paginatedRows = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, currentPage]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    setFocusedIndex(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  };

  React.useEffect(() => {
    setFocusedIndex((i) => Math.min(i, Math.max(paginatedRows.length - 1, 0)));
  }, [paginatedRows.length]);

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

  const expandedIdx = expandedTicker ? paginatedRows.findIndex((r) => r.ticker === expandedTicker) : -1;

  function getRowTop(idx: number): number {
    let top = idx * rowHeight;
    if (expandedIdx >= 0 && idx > expandedIdx) {
      top += EXPANDED_HEIGHT;
    }
    return top;
  }

  const totalRows = paginatedRows.length;
  const overscan = 8;
  const visibleStart = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / rowHeight) + overscan * 2;
  const visibleEnd = Math.min(totalRows, visibleStart + visibleCount);

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
      const row = paginatedRows[focusedIndex];
      if (row) onActivateRow(row.ticker);
    } else if (e.key === " ") {
      e.preventDefault();
      const row = paginatedRows[focusedIndex];
      if (row) onToggleSelect(row.ticker);
    } else if (e.key.toLowerCase() === "w") {
      e.preventDefault();
      const row = paginatedRows[focusedIndex];
      if (row) onToggleWatch(row.ticker);
    } else if (e.key.toLowerCase() === "y") {
      e.preventDefault();
      const row = paginatedRows[focusedIndex];
      if (row) {
        const line = [row.ticker, row.name, row.industry_name, row.current_price, row.day_change_pct, row.ivGapPct, row.market_cap]
          .map((v) => (v == null ? "" : String(v)))
          .join("\t");
        void navigator.clipboard?.writeText(line).catch(() => undefined);
      }
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const row = paginatedRows[focusedIndex];
      if (row) toggleExpand(row.ticker);
    } else if (e.key === "PageUp") {
      e.preventDefault();
      if (currentPage > 1) {
        handlePageChange(currentPage - 1);
      }
    } else if (e.key === "PageDown") {
      e.preventDefault();
      if (currentPage < totalPages) {
        handlePageChange(currentPage + 1);
      }
    }
  }

  const totalWidth = PINNED_COLUMN_WIDTH + resolvedColumns.reduce((sum, c) => sum + c.width, 0);

  function sortPriority(key: string): number | null {
    if (sort.key === key) return 1;
    if (sort.secondary?.key === key) return 2;
    return null;
  }

  const totalHeight = totalRows * rowHeight + (expandedIdx >= 0 ? EXPANDED_HEIGHT : 0);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="grid"
      aria-label="Market screener results"
      className="relative min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent/30"
    >
      <div style={{ minWidth: totalWidth }}>
        {/* Header */}
        <div className="sticky top-0 z-20 flex border-b border-[var(--term-divider)] bg-[var(--term-bg)]" role="row">
          <button
            type="button"
            onClick={() => onSort("ticker")}
            className="sticky left-0 z-30 flex items-center gap-1 bg-[var(--term-bg)] pl-2 pr-2 font-mono text-[11px] font-semibold uppercase tracking-[0.04em] text-[color:var(--term-amber)]/90 transition-colors"
            style={{ width: PINNED_COLUMN_WIDTH, minWidth: PINNED_COLUMN_WIDTH, height: 28 }}
          >
            Tkr / Company
            {sort.key === "ticker" && (
              <span className="text-[color:var(--term-ink)]">{sort.direction === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />}</span>
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
                    "flex flex-1 items-center gap-1 px-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.04em] text-[color:var(--term-amber)]/90 transition-colors hover:text-[color:var(--term-amber)]",
                    col.align === "right" && "justify-end text-right"
                  )}
                  style={{ height: 28 }}
                >
                  <span>{col.header}</span>
                  {isSorted && (
                    <>
                      <span className="text-[9px] text-[color:var(--term-ink-tertiary)]">{priority > 1 ? priority : ""}</span>
                      <span className="text-[color:var(--term-ink)]">
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
        <div style={{ position: "relative", height: totalHeight }}>
          {paginatedRows.slice(visibleStart, visibleEnd).map((row, i) => {
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
                  onExpand={() => toggleExpand(row.ticker)}
                  onSectorClick={onSectorClick}
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

        {/* Pagination & Footer hints */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--term-divider)] bg-[var(--term-bg)] px-4 py-2 font-mono text-micro text-[color:var(--term-ink-secondary)]">
          <div>
            SHOWING {rows.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} - {Math.min(currentPage * PAGE_SIZE, rows.length)} OF {rows.length} COMPANIES
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className={cn(
                  "px-2 py-0.5 border text-[10px] font-semibold transition-colors uppercase tracking-wider",
                  currentPage === 1
                    ? "border-[color:var(--term-divider)] text-[color:var(--term-ink-tertiary)] cursor-not-allowed"
                    : "border-[color:var(--term-amber)]/60 text-[color:var(--term-amber)] hover:bg-[color:var(--term-amber)]/10"
                )}
              >
                &lt; PREV
              </button>
              <span className="text-[color:var(--term-amber)]">
                PAGE {currentPage} OF {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className={cn(
                  "px-2 py-0.5 border text-[10px] font-semibold transition-colors uppercase tracking-wider",
                  currentPage === totalPages
                    ? "border-[color:var(--term-divider)] text-[color:var(--term-ink-tertiary)] cursor-not-allowed"
                    : "border-[color:var(--term-amber)]/60 text-[color:var(--term-amber)] hover:bg-[color:var(--term-amber)]/10"
                )}
              >
                NEXT &gt;
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
