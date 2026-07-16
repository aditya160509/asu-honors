"use client";

import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { X, BarChart3 } from "lucide-react";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import { drawGrid } from "@/lib/charts/core/Grid";
import { drawLineSeries } from "@/lib/charts/series/LineSeries";
import { get } from "@/lib/api/client";
import type { EnrichedCompany } from "@/lib/market/types";
import type { PriceHistoryItem } from "@/lib/api/types";

export interface ComparisonOverlayProps {
  companies: EnrichedCompany[];
  selectedTickers: string[];
  onRemoveTicker: (ticker: string) => void;
  height?: number;
}

const LINE_COLORS = ["#0ea5e9", "#f97316", "#8b5cf6", "#22c55e", "#ef4444", "#06b6d4"];

/** % change from the first close in the window — same approach as PortfolioPerformancePanel's normalizePct. */
function normalizePct(items: PriceHistoryItem[]): { time: number; value: number }[] {
  if (items.length === 0) return [];
  const base = Number(items[0].close) || 1;
  return items.map((item, i) => ({ time: i, value: ((Number(item.close) - base) / base) * 100 }));
}

export function ComparisonOverlay({
  companies,
  selectedTickers,
  onRemoveTicker,
  height = 260,
}: ComparisonOverlayProps) {
  const [hover, setHover] = React.useState<{ x: number; y: number } | null>(null);
  const [activeLine, setActiveLine] = React.useState<number | null>(null);
  const widthRef = React.useRef(0);

  const selected = React.useMemo(
    () => selectedTickers.map((t) => companies.find((c) => c.ticker === t)).filter(Boolean) as EnrichedCompany[],
    [companies, selectedTickers]
  );

  // Same queryKey shape as usePriceHistory(ticker) (no timelineId/from/to) so this
  // shares the react-query cache with the company detail page instead of double-fetching.
  const historyQueries = useQueries({
    queries: selected.map((c) => ({
      queryKey: ["history", c.ticker, undefined, undefined, undefined],
      queryFn: () => get<PriceHistoryItem[]>(`/companies/${c.ticker}/history`),
      staleTime: 30_000,
    })),
  });

  const PADDING = React.useMemo(() => ({ top: 12, right: 16, bottom: 28, left: 56 }), []);

  const lines = React.useMemo(() => {
    return selected.map((c, i) => {
      const items = historyQueries[i]?.data ?? [];
      const points = normalizePct(items);
      const change = points.length > 0 ? points[points.length - 1].value : 0;
      return { ticker: c.ticker, points, change };
    });
  }, [selected, historyQueries]);

  const maxPoints = React.useMemo(() => Math.max(1, ...lines.map((l) => l.points.length)), [lines]);

  const allValues = React.useMemo(() => {
    const vals: number[] = [];
    for (const line of lines) for (const p of line.points) vals.push(p.value);
    return vals;
  }, [lines]);

  const yDomain = React.useMemo((): [number, number] => {
    if (allValues.length === 0) return [-5, 5];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const pad = Math.max(Math.abs(min), Math.abs(max), 1) * 0.2;
    return [Math.min(min, -pad), Math.max(max, pad)];
  }, [allValues]);

  const render = React.useCallback(
    ({ ctx, width, height: h, dpr }: { ctx: CanvasRenderingContext2D; width: number; height: number; dpr: number }) => {
      widthRef.current = width;
      if (lines.length === 0) return;

      drawGrid({ ctx, width, height: h, dpr, padding: PADDING });

      const [yMin, yMax] = yDomain;
      const ySpan = yMax - yMin || 1;

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const yForZero = PADDING.top + (h - PADDING.top - PADDING.bottom) * (1 - (0 - yMin) / ySpan);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, yForZero);
      ctx.lineTo(width - PADDING.right, yForZero);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      lines.forEach((line, i) => {
        if (line.points.length < 2) return;
        const color = LINE_COLORS[i % LINE_COLORS.length];
        const isActive = activeLine === i;
        drawLineSeries({
          ctx,
          data: line.points,
          width,
          height: h,
          padding: PADDING,
          yDomain,
          color,
          lineWidth: isActive ? 2.5 : 1.5,
        });
      });

      if (hover && lines.length > 0) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(hover.x, PADDING.top);
        ctx.lineTo(hover.x, h - PADDING.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(15,17,23,0.9)";
        ctx.beginPath();
        ctx.roundRect(hover.x + 8, hover.y - 40, 140, lines.length * 18 + 12, 4);
        ctx.fill();

        lines.forEach((line, i) => {
          const color = LINE_COLORS[i % LINE_COLORS.length];
          const yPos = hover.y - 34 + i * 18;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(hover.x + 16, yPos + 4, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.font = "600 9px system-ui";
          ctx.textAlign = "left";
          ctx.fillText(line.ticker, hover.x + 22, yPos + 7);
          ctx.fillStyle = line.change >= 0 ? "#22c55e" : "#ef4444";
          ctx.fillText(`${line.change >= 0 ? "+" : ""}${line.change.toFixed(2)}%`, hover.x + 60, yPos + 7);
        });

        ctx.restore();
      }
    },
    [lines, yDomain, hover, activeLine, PADDING]
  );

  function handlePointerMove(x: number, y: number) {
    setHover({ x, y });
    const plotW = Math.max(1, widthRef.current - PADDING.left - PADDING.right);
    const frac = (x - PADDING.left) / plotW;
    const timeIdx = Math.round(frac * (maxPoints - 1));
    let closest = 0;
    let closestDist = Infinity;
    lines.forEach((line, i) => {
      if (timeIdx >= 0 && timeIdx < line.points.length) {
        const val = line.points[timeIdx].value;
        const [yMin, yMax] = yDomain;
        const plotH = height - PADDING.top - PADDING.bottom;
        const yPx = PADDING.top + plotH * (1 - (val - yMin) / (yMax - yMin));
        const dist = Math.abs(y - yPx);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      }
    });
    setActiveLine(closestDist < 30 ? closest : null);
  }

  if (selected.length === 0) {
    return (
      <div className="rounded-md border border-border/50 bg-bg-tertiary/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-text-tertiary" />
          <span className="text-micro text-text-tertiary">
            Select up to 4 companies to compare — check the boxes in the table
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-md border border-border bg-bg-secondary p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-small font-semibold text-text-primary">Performance Comparison</h3>
        <div className="flex items-center gap-2">
          {selected.map((c, i) => (
            <div
              key={c.ticker}
              className="flex items-center gap-1 rounded-sm border border-border/50 px-1.5 py-0.5"
              onMouseEnter={() => setActiveLine(i)}
              onMouseLeave={() => setActiveLine(null)}
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }}
              />
              <span className="text-micro font-medium text-text-primary">{c.ticker}</span>
              <button
                type="button"
                onClick={() => onRemoveTicker(c.ticker)}
                className="text-text-tertiary hover:text-negative transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <ChartSurface
        height={height}
        padding={PADDING}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          setHover(null);
          setActiveLine(null);
        }}
      >
        {render}
      </ChartSurface>
      <div className="mt-1 flex items-center justify-center gap-3">
        <span className="text-micro text-text-tertiary">Cumulative Return %</span>
      </div>
    </div>
  );
}
