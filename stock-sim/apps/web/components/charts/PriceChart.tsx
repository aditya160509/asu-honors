"use client";

import * as React from "react";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import { drawGrid } from "@/lib/charts/core/Grid";
import { drawPriceAxis, drawTimeAxis } from "@/lib/charts/core/Axis";
import { drawCrosshair, drawCrosshairTooltip } from "@/lib/charts/core/Crosshair";
import { drawCandlestickSeries, candlestickYDomain } from "@/lib/charts/series/CandlestickSeries";
import { drawVolumeSeries } from "@/lib/charts/series/VolumeSeries";
import { drawLineSeries } from "@/lib/charts/series/LineSeries";
import { computeVolumeProfile, drawVolumeProfile } from "@/lib/charts/series/VolumeProfile";
import { computeSMA } from "@/lib/charts/indicators/sma";
import { computeEMA } from "@/lib/charts/indicators/ema";
import { defaultRange, panRange, zoomRange } from "@/lib/charts/core/Viewport";
import { formatDateAxis, formatPriceAxis } from "@/lib/charts/core/utils";
import type { LinePoint, OHLC, VisibleRange } from "@/lib/charts/types";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import type { PriceHistoryItem } from "@/lib/api/types";

export type IndicatorKey = "sma20" | "sma50" | "ema12";

const INDICATOR_CONFIG: Record<IndicatorKey, { label: string; color: string; compute: (closes: number[]) => (number | null)[] }> = {
  sma20: { label: "SMA 20", color: "#f59e0b", compute: (closes) => computeSMA(closes, 20) },
  sma50: { label: "SMA 50", color: "#3b82f6", compute: (closes) => computeSMA(closes, 50) },
  ema12: { label: "EMA 12", color: "#14b8a6", compute: (closes) => computeEMA(closes, 12) },
};

export interface PriceChartProps {
  data: PriceHistoryItem[];
  height?: number;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  ticker: string;
  /** Optional SMA/EMA overlays — none by default. */
  indicators?: IndicatorKey[];
  /** Optional volume-by-price histogram (VPVR) with Point-of-Control line — off by default. */
  showVolumeProfile?: boolean;
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

export function PriceChart({
  data,
  height = 400,
  loading,
  error,
  onRetry,
  ticker,
  indicators = [],
  showVolumeProfile = false,
}: PriceChartProps) {
  const ohlc = React.useMemo(() => toOHLC(data), [data]);
  const [range, setRange] = React.useState<VisibleRange>(() => defaultRange(ohlc.length));
  const [hover, setHover] = React.useState<{ x: number; y: number } | null>(null);
  const isPanning = React.useRef(false);
  const panStartX = React.useRef(0);
  const panStartRange = React.useRef<VisibleRange>({ from: 0, to: 0 });
  const widthRef = React.useRef(0);
  const prevTickerRef = React.useRef(ticker);
  const prevLenRef = React.useRef(ohlc.length);
  const rangeRef = React.useRef(range);
  rangeRef.current = range;

  React.useEffect(() => {
    const tickerChanged = prevTickerRef.current !== ticker;
    const prevLen = prevLenRef.current;
    prevTickerRef.current = ticker;
    prevLenRef.current = ohlc.length;

    if (tickerChanged || prevLen === 0) {
      // New instrument (or first load) — nothing to preserve, show the default window.
      setRange(defaultRange(ohlc.length));
      return;
    }
    if (ohlc.length === prevLen) return;

    // Same ticker, new candles arrived (e.g. live auto-advance). If the user
    // was already looking at the latest bar, keep following it — same zoom
    // width, window slides right — instead of yanking their pan/zoom back to
    // the default every time a new tick lands. If they'd panned into history
    // to look at older data, leave their view alone.
    const wasAtLiveEdge = rangeRef.current.to >= prevLen;
    if (wasAtLiveEdge) {
      const span = rangeRef.current.to - rangeRef.current.from;
      const to = ohlc.length;
      const from = Math.max(0, to - span);
      setRange({ from, to });
    }
  }, [ohlc.length, ticker]);

  // Computed once per data/indicator-selection change, not per render frame —
  // `time` stays a true index into `ohlc` even after null-filtering, so
  // visibility filtering below stays correct.
  const indicatorSeries = React.useMemo(() => {
    const closes = ohlc.map((c) => c.close);
    return indicators.map((key) => {
      const config = INDICATOR_CONFIG[key];
      const values = config.compute(closes);
      const points: LinePoint[] = [];
      values.forEach((v, i) => {
        if (v != null) points.push({ time: i, value: v });
      });
      return { key, color: config.color, points };
    });
  }, [ohlc, indicators]);

  const render = React.useCallback(
    ({ ctx, width, height: h, dpr }: { ctx: CanvasRenderingContext2D; width: number; height: number; dpr: number }) => {
      widthRef.current = width;
      if (ohlc.length === 0) return;
      const priceAreaHeight = h - PADDING.bottom - PADDING.top - VOLUME_HEIGHT;
      const pricePadding = { ...PADDING, bottom: PADDING.bottom + VOLUME_HEIGHT };
      const yDomain = candlestickYDomain(ohlc, range);

      drawGrid({ ctx, width, height: h, dpr, padding: pricePadding });

      if (showVolumeProfile) {
        const buckets = computeVolumeProfile(ohlc, range);
        drawVolumeProfile({ ctx, buckets, width, padding: pricePadding, yDomain, priceAreaHeight });
      }

      drawCandlestickSeries({ ctx, data: ohlc, visibleRange: range, width, height: h, dpr, padding: pricePadding, yDomain });

      indicatorSeries.forEach(({ color, points }) => {
        const visiblePoints = points.filter((p) => p.time >= range.from && p.time < range.to);
        if (visiblePoints.length > 1) {
          drawLineSeries({ ctx, data: visiblePoints, width, height: h, padding: pricePadding, yDomain, color, lineWidth: 1.25 });
        }
      });

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
    [ohlc, range, hover, data, indicatorSeries, showVolumeProfile]
  );

  function handleWheel(deltaY: number, x: number) {
    const plotW = Math.max(1, widthRef.current - PADDING.left - PADDING.right);
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
      const plotW = Math.max(1, widthRef.current - PADDING.left - PADDING.right);
      const deltaCandles = Math.round(((panStartX.current - x) / plotW) * span);
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

export { INDICATOR_CONFIG };
