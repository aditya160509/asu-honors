"use client";

import * as React from "react";
import { cn, formatPrice, formatLarge, formatPct } from "@/lib/utils";
import type { EnrichedCompany } from "@/lib/market/types";

export interface HeatmapViewProps {
  companies: EnrichedCompany[];
  onActivateRow: (ticker: string) => void;
}

function changeColor(changePct: number | null): string {
  if (changePct == null) return "rgba(55,65,81,0.4)";
  const clamped = Math.max(-5, Math.min(5, changePct));
  const t = (clamped + 5) / 10; // 0 = worst down, 1 = best up
  if (clamped >= 0) {
    const r = Math.round(30 + (1 - t) * 30);
    const g = Math.round(80 + t * 115);
    const b = Math.round(55 + t * 35);
    return `rgba(${r},${g},${b},0.78)`;
  }
  const r = Math.round(170 + (1 - t) * 50);
  const g = Math.round(45 + t * 40);
  const b = Math.round(50 + t * 20);
  return `rgba(${r},${g},${b},0.78)`;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function squarify(items: { id: string; value: number }[], rect: Rect): Map<string, Rect> {
  const result = new Map<string, Rect>();
  if (items.length === 0) return result;

  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return result;

  const sorted = [...items].sort((a, b) => b.value - a.value);

  function layout(row: typeof sorted, r: Rect) {
    if (row.length === 0) return;
    if (row.length === 1) {
      result.set(row[0].id, r);
      return;
    }

    const rowTotal = row.reduce((s, i) => s + i.value, 0);
    const isWide = r.w >= r.h;
    const primary = isWide ? r.w : r.h;
    const secondary = isWide ? r.h : r.w;

    let rowSum = 0;
    let bestRatio = Infinity;
    let splitIdx = 0;

    for (let i = 0; i < row.length; i++) {
      rowSum += row[i].value;
      const frac = rowSum / rowTotal;
      const rowPrimary = primary * frac;
      let worst = 0;
      let cumSum = 0;
      for (let j = 0; j <= i; j++) {
        cumSum += row[j].value;
        const cellFrac = cumSum / rowSum;
        const cellW = isWide ? rowPrimary : secondary * cellFrac;
        const cellH = isWide ? secondary * cellFrac : rowPrimary;
        const aspect = Math.max(cellW / cellH, cellH / cellW);
        worst = Math.max(worst, aspect);
      }
      if (worst <= bestRatio) {
        bestRatio = worst;
        splitIdx = i;
      } else {
        break;
      }
    }

    const left = row.slice(0, splitIdx + 1);
    const right = row.slice(splitIdx + 1);
    const leftTotal = left.reduce((s, i) => s + i.value, 0);
    const leftFrac = leftTotal / rowTotal;
    const leftPrimary = primary * leftFrac;

    let offset = 0;
    for (const item of left) {
      const cellFrac = item.value / leftTotal;
      if (isWide) {
        const cellRect = { x: r.x, y: r.y + offset, w: leftPrimary, h: secondary * cellFrac };
        result.set(item.id, cellRect);
        offset += secondary * cellFrac;
      } else {
        const cellRect = { x: r.x + offset, y: r.y, w: secondary * cellFrac, h: leftPrimary };
        result.set(item.id, cellRect);
        offset += secondary * cellFrac;
      }
    }

    if (right.length > 0) {
      if (isWide) {
        layout(right, { x: r.x + leftPrimary, y: r.y, w: primary - leftPrimary, h: secondary });
      } else {
        layout(right, { x: r.x, y: r.y + leftPrimary, w: secondary, h: primary - leftPrimary });
      }
    }
  }

  layout(sorted, rect);
  return result;
}

function HeatmapTile({
  company,
  rect,
  onActivate,
  colorMode,
}: {
  company: EnrichedCompany;
  rect: Rect;
  onActivate: () => void;
  colorMode: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);
  const changePct = company.day_change_pct != null ? Number(company.day_change_pct) : null;
  const positive = changePct != null && changePct >= 0;
  // When colorMode is off, use a neutral dark slate for all tiles
  const bg = colorMode ? changeColor(changePct) : "rgba(40,48,64,0.65)";
  const showDetail = rect.w > 100 && rect.h > 60;
  const showPrice = rect.h > 35;

  return (
    <button
      type="button"
      onClick={onActivate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
   className={cn(
      "absolute flex flex-col items-start justify-between overflow-hidden transition-all duration-fast ease-out-expo cursor-pointer",
       hovered && "ring-1 ring-white/40 z-10"
     )}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        backgroundColor: bg,
        padding: rect.w > 60 ? "6px 8px" : "3px 4px",
      }}
    >
      <div className="flex w-full items-start justify-between gap-1">
        <span
          className="font-bold uppercase tracking-tight text-white/95 drop-shadow-sm leading-none"
          style={{ fontSize: rect.w > 120 ? 11 : rect.w > 70 ? 9 : 7 }}
        >
          {company.ticker}
        </span>
        {changePct != null && rect.w > 50 && (
          <span
            className={cn(
              "font-bold tabular-nums leading-none drop-shadow-sm",
              positive ? "text-green-200" : "text-red-200"
            )}
            style={{ fontSize: rect.w > 100 ? 10 : 8 }}
          >
            {positive ? "+" : ""}
            {changePct.toFixed(1)}%
          </span>
        )}
      </div>

      {showPrice && (
        <div className="flex w-full items-end justify-between">
          <span className="font-mono tabular-nums text-white/70" style={{ fontSize: rect.w > 100 ? 10 : 8 }}>
            {formatPrice(company.current_price)}
          </span>
          {showDetail && company.market_cap != null && (
            <span className="font-medium tabular-nums text-white/45" style={{ fontSize: 8 }}>
              {formatLarge(company.market_cap)}
            </span>
          )}
        </div>
      )}

      {hovered && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/65 backdrop-blur-[2px] transition-opacity duration-base ease-out-expo p-2">
          <div className="text-center min-w-0">
            <div className="text-[10px] font-bold text-white truncate">{company.name}</div>
            <div className="text-[8px] text-white/60 truncate">{company.industry_name}</div>
            <div className="mt-1 flex items-center justify-center gap-2 text-[8px]">
              <span className="text-white/70">{formatPrice(company.current_price)}</span>
              {company.ivGapPct != null && (
                <span className={company.ivGapPct < 0 ? "text-green-300" : "text-red-300"}>
                  IV {formatPct(company.ivGapPct)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </button>
  );
}

export function HeatmapView({ companies, onActivateRow }: HeatmapViewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dims, setDims] = React.useState({ w: 800, h: 500 });
  // Toggle for colored tiles (day change) vs neutral tiles. Defaults to ON so
  // production reviewers can immediately see the color-coded layout; flip to
  // neutral to evaluate pure size-by-market-cap readability.
  const [colorMode, setColorMode] = React.useState(true);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setDims({ w: r.width, h: r.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const grouped = React.useMemo(() => {
    const map = new Map<string, EnrichedCompany[]>();
    for (const c of companies) {
      const key = c.industry_name || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const capA = a[1].reduce((s, c) => s + (c.market_cap ?? 0), 0);
      const capB = b[1].reduce((s, c) => s + (c.market_cap ?? 0), 0);
      return capB - capA;
    });
  }, [companies]);

  const allItems = React.useMemo(() => {
    return companies.map((c) => ({
      id: c.ticker,
      value: Math.max(c.market_cap ?? 1e6, 1e6),
      company: c,
    }));
  }, [companies]);

  const rects = React.useMemo(() => {
    return squarify(allItems, { x: 0, y: 0, w: dims.w, h: dims.h });
  }, [allItems, dims]);

  if (companies.length === 0) return null;

  return (
    <div ref={containerRef} className="relative h-full flex-1 overflow-auto">
      {/* Color mode toggle — top-right corner */}
      <button
        type="button"
        onClick={() => setColorMode((v) => !v)}
        className="absolute top-2 right-2 z-20 flex items-center gap-1.5 rounded border border-border/60 bg-bg-secondary/90 px-2 py-1 text-micro font-medium text-text-secondary backdrop-blur-sm hover:bg-bg-hover transition-colors"
      >
        <span
          className={cn("inline-block h-2 w-2 rounded-full", colorMode ? "bg-positive" : "bg-text-tertiary")}
        />
        {colorMode ? "Color" : "Neutral"}
      </button>
      <div className="relative" style={{ width: dims.w, height: dims.h, minWidth: dims.w, minHeight: dims.h }}>
        {allItems.map((item) => {
          const rect = rects.get(item.id);
          if (!rect || rect.w < 2 || rect.h < 2) return null;
          return (
            <HeatmapTile
              key={item.id}
              company={item.company}
              rect={rect}
              onActivate={() => onActivateRow(item.id)}
              colorMode={colorMode}
            />
          );
        })}
      </div>
    </div>
  );
}
