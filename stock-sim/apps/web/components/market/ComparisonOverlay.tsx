"use client";

import * as React from "react";
import { X, BarChart3 } from "lucide-react";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import { drawGrid } from "@/lib/charts/core/Grid";
import { drawLineSeries, lineYDomain } from "@/lib/charts/series/LineSeries";
import { cn, formatPct } from "@/lib/utils";
import type { EnrichedCompany } from "@/lib/market/types";

export interface ComparisonOverlayProps {
  companies: EnrichedCompany[];
  selectedTickers: string[];
  onRemoveTicker: (ticker: string) => void;
  height?: number;
}

const LINE_COLORS = ["#0ea5e9", "#f97316", "#8b5cf6", "#22c55e", "#ef4444", "#06b6d4"];

export function ComparisonOverlay({
  companies,
  selectedTickers,
  onRemoveTicker,
  height = 260,
}: ComparisonOverlayProps) {
  const [hover, setHover] = React.useState<{ x: number; y: number } | null>(null);
  const [activeLine, setActiveLine] = React.useState<number | null>(null);

  const selected = React.useMemo(
    () => selectedTickers.map((t) => companies.find((c) => c.ticker === t)).filter(Boolean) as EnrichedCompany[],
    [companies, selectedTickers]
  );

  const PADDING = React.useMemo(() => ({ top: 12, right: 16, bottom: 28, left: 56 }), []);

  const lines = React.useMemo(() => {
    return selected.map((c) => {
      const price = Number(c.current_price);
      const prevClose = c.prev_close != null ? Number(c.prev_close) : price;
      const base = prevClose || price || 1;
      const points = [
        { time: 0, value: 0 },
        { time: 1, value: prevClose != null ? ((price - prevClose) / prevClose) * 100 : 0 },
      ];
      return { ticker: c.ticker, points, currentPrice: price, change: c.day_change_pct != null ? Number(c.day_change_pct) : 0 };
    });
  }, [selected]);

  const allValues = React.useMemo(() => {
    const vals: number[] = [];
    for (const line of lines) {
      for (const p of line.points) vals.push(p.value);
    }
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
      if (lines.length === 0) return;

      drawGrid({ ctx, width, height: h, dpr, padding: PADDING });

      const plotW = width - PADDING.left - PADDING.right;
      const [yMin, yMax] = yDomain;
      const ySpan = yMax - yMin || 1;

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const zeroY = PADDING.top + (plotW * 0) * (1 - (0 - yMin) / ySpan);
      const yForZero = PADDING.top + (h - PADDING.top - PADDING.bottom) * (1 - (0 - yMin) / ySpan);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, yForZero);
      ctx.lineTo(width - PADDING.right, yForZero);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      lines.forEach((line, i) => {
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
    [lines, yDomain, hover, activeLine]
  );

  function handlePointerMove(x: number, y: number) {
    setHover({ x, y });
    const plotW = 800 - PADDING.left - PADDING.right;
    const frac = (x - PADDING.left) / plotW;
    const timeIdx = Math.round(frac);
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
        <span className="text-micro text-text-tertiary">Day Change %</span>
      </div>
    </div>
  );
}
