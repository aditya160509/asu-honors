"use client";

import * as React from "react";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import { drawGrid } from "@/lib/charts/core/Grid";
import { drawPriceAxis, drawTimeAxis } from "@/lib/charts/core/Axis";
import { drawCrosshair, drawCrosshairTooltip } from "@/lib/charts/core/Crosshair";
import { drawCandlestickSeries, candlestickYDomain } from "@/lib/charts/series/CandlestickSeries";
import { drawVolumeSeries } from "@/lib/charts/series/VolumeSeries";
import { defaultRange, panRange, zoomRange } from "@/lib/charts/core/Viewport";
import { formatDateAxis, formatPriceAxis } from "@/lib/charts/core/utils";
import type { OHLC, VisibleRange } from "@/lib/charts/types";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import type { PriceHistoryItem } from "@/lib/api/types";

export interface PriceChartProps {
  data: PriceHistoryItem[];
  height?: number;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  ticker: string;
}

const PADDING = { top: 8, right: 56, bottom: 24, left: 8 };
const VOLUME_HEIGHT = 60;

function toOHLC(items: PriceHistoryItem[]): OHLC[] {
  return items.map((item, i) => ({
    time: i,
    open: Number(item.open),
    high: Number(item.high),
    low: Number(item.low),
    close: Number(item.close),
    volume: item.volume,
  }));
}

export function PriceChart({ data, height = 400, loading, error, onRetry, ticker }: PriceChartProps) {
  const ohlc = React.useMemo(() => toOHLC(data), [data]);
  const [range, setRange] = React.useState<VisibleRange>(() => defaultRange(ohlc.length));
  const [hover, setHover] = React.useState<{ x: number; y: number } | null>(null);
  const isPanning = React.useRef(false);
  const panStartX = React.useRef(0);
  const panStartRange = React.useRef<VisibleRange>({ from: 0, to: 0 });

  React.useEffect(() => {
    setRange(defaultRange(ohlc.length));
  }, [ohlc.length]);

  const render = React.useCallback(
    ({ ctx, width, height: h, dpr }: { ctx: CanvasRenderingContext2D; width: number; height: number; dpr: number }) => {
      if (ohlc.length === 0) return;
      const priceAreaHeight = h - PADDING.bottom - PADDING.top - VOLUME_HEIGHT;
      const pricePadding = { ...PADDING, bottom: PADDING.bottom + VOLUME_HEIGHT };
      const yDomain = candlestickYDomain(ohlc, range);

      drawGrid({ ctx, width, height: h, dpr, padding: pricePadding });
      drawCandlestickSeries({ ctx, data: ohlc, visibleRange: range, width, height: h, dpr, padding: pricePadding, yDomain });
      drawVolumeSeries({
        ctx,
        data: ohlc,
        visibleRange: range,
        width,
        panelTop: PADDING.top + priceAreaHeight,
        panelHeight: VOLUME_HEIGHT,
        padding: PADDING,
      });
      drawPriceAxis({ ctx, width, height: h, padding: pricePadding, yDomain, formatY: formatPriceAxis });

      const visible = ohlc.slice(range.from, range.to);
      if (visible.length > 0) {
        const labelCount = Math.min(6, visible.length);
        const step = Math.max(1, Math.floor(visible.length / labelCount));
        const labels = visible
          .filter((_, i) => i % step === 0)
          .map((c) => ({
            x: PADDING.left + ((c.time - range.from + 0.5) / (range.to - range.from)) * (width - PADDING.left - PADDING.right),
            text: formatDateAxis(new Date(data[c.time]?.sim_date ?? "").getTime()),
          }));
        drawTimeAxis({ ctx, width, height: h, padding: pricePadding, labels });
      }

      if (hover) {
        drawCrosshair({ ctx, width, height: h, dpr, padding: pricePadding, x: hover.x, y: hover.y });
        const plotW = width - PADDING.left - PADDING.right;
        const idx = range.from + Math.round(((hover.x - PADDING.left) / plotW) * (range.to - range.from));
        const candle = ohlc[Math.max(0, Math.min(ohlc.length - 1, idx))];
        const item = data[candle?.time ?? 0];
        if (candle && item) {
          drawCrosshairTooltip({
            ctx,
            x: hover.x,
            y: hover.y,
            lines: [
              item.sim_date,
              `O ${candle.open.toFixed(2)}  H ${candle.high.toFixed(2)}`,
              `L ${candle.low.toFixed(2)}  C ${candle.close.toFixed(2)}`,
              `Vol ${candle.volume.toLocaleString()}`,
            ],
          });
        }
      }
    },
    [ohlc, range, hover, data]
  );

  function handleWheel(deltaY: number, x: number) {
    const plotW = 1000;
    const frac = Math.max(0, Math.min(1, (x - PADDING.left) / plotW));
    setRange((prev) => zoomRange(prev, ohlc.length, deltaY > 0 ? 1.1 : 1 / 1.1, frac));
  }

  function handlePointerDown(x: number) {
    isPanning.current = true;
    panStartX.current = x;
    panStartRange.current = range;
  }

  function handlePointerMove(x: number, y: number) {
    setHover({ x, y });
    if (isPanning.current) {
      const span = panStartRange.current.to - panStartRange.current.from;
      const deltaCandles = Math.round(((panStartX.current - x) / 1000) * span);
      setRange(panRange(panStartRange.current, ohlc.length, deltaCandles));
    }
  }

  if (loading) return <Skeleton height={height} className="w-full" />;
  if (error) return <ErrorState message="Could not load price history." onRetry={onRetry} />;
  if (ohlc.length === 0) return <EmptyState title={`No trading data yet for ${ticker}.`} />;

  return (
    <ChartSurface
      height={height}
      padding={PADDING}
      onWheel={handleWheel}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        setHover(null);
        isPanning.current = false;
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={() => (isPanning.current = false)}
      onDoubleClick={() => setRange(defaultRange(ohlc.length))}
    >
      {render}
    </ChartSurface>
  );
}
