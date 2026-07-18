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
import { computeHeikinAshi, drawHeikinAshiSeries, heikinAshiYDomain } from "@/lib/charts/series/HeikinAshi";
import { drawHollowCandlestickSeries } from "@/lib/charts/series/HollowCandlestick";
import { drawBaselineSeries } from "@/lib/charts/series/BaselineSeries";
import { computeSMA } from "@/lib/charts/indicators/sma";
import { computeEMA } from "@/lib/charts/indicators/ema";
import { computeBollinger } from "@/lib/charts/indicators/bollinger";
import { computeVWAP } from "@/lib/charts/indicators/vwap";
import { computeIchimoku } from "@/lib/charts/indicators/ichimoku";
import { computeSuperTrend } from "@/lib/charts/indicators/superTrend";
import { defaultRange, panRange, zoomRange } from "@/lib/charts/core/Viewport";
import { formatDateAxis, formatPriceAxis } from "@/lib/charts/core/utils";
import type { LinePoint, OHLC, VisibleRange, ChartType } from "@/lib/charts/types";
import { alignToDevicePixel } from "@/lib/charts/core/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import type { PriceHistoryItem } from "@/lib/api/types";
import type { DrawingManager } from "@/lib/charts/drawing/DrawingManager";
import type { Drawing, DrawingPoint, DrawingToolType } from "@/lib/charts/drawing/types";
import { DEFAULT_DRAWING_STYLE } from "@/lib/charts/drawing/types";
import { renderDrawing } from "@/lib/charts/drawing/renderers";
import { getRequiredPoints } from "@/lib/charts/drawing/interactions";
import { renderEventMarkers, hitTestEvent, EventMarkerTooltip } from "@/components/charts/EventMarkers";
import type { EventMarker } from "@/components/charts/EventMarkers";

export type IndicatorKey = "sma20" | "sma50" | "ema12" | "bollinger" | "vwap" | "ichimoku" | "superTrend";

const INDICATOR_CONFIG: Record<Exclude<IndicatorKey, "bollinger" | "vwap" | "ichimoku" | "superTrend">, { label: string; color: string; compute: (closes: number[]) => (number | null)[] }> = {
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
  /** Chart rendering style — defaults to candlestick. */
  chartType?: ChartType;
  /** Drawing manager instance for chart annotations. */
  drawingManager?: DrawingManager;
  /** Currently active drawing tool (null = no drawing tool active). */
  activeDrawingTool?: DrawingToolType | null;
  /** Event markers to render on the chart timeline. */
  events?: EventMarker[];
  /** Optional externally controlled viewport range. */
  externalRange?: VisibleRange;
  /** Emits viewport changes so lower panes can stay aligned. */
  onRangeChange?: (range: VisibleRange) => void;
  /** When enabled, next chart click selects a replay start candle instead of panning/drawing. */
  replayPickMode?: boolean;
  onReplayPointSelect?: (localIndex: number, item: PriceHistoryItem) => void;
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
    volume: Number(item.volume),
  }));
}

function toLinePoints(values: (number | null)[]): LinePoint[] {
  return values.reduce<LinePoint[]>((acc, value, time) => {
    if (value != null && Number.isFinite(value)) acc.push({ time, value });
    return acc;
  }, []);
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
  chartType = "candlestick",
  drawingManager,
  activeDrawingTool = null,
  events = [],
  externalRange,
  onRangeChange,
  replayPickMode = false,
  onReplayPointSelect,
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

  const [placingPoints, setPlacingPoints] = React.useState<DrawingPoint[]>([]);
  const [previewPoint, setPreviewPoint] = React.useState<DrawingPoint | null>(null);
  const [hoveredEvent, setHoveredEvent] = React.useState<EventMarker | null>(null);
  const [hoveredEventPos, setHoveredEventPos] = React.useState<{ x: number; y: number } | null>(null);
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  const updateRange = React.useCallback((next: VisibleRange | ((prev: VisibleRange) => VisibleRange)) => {
    setRange((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      if (prev.from === resolved.from && prev.to === resolved.to) return prev;
      onRangeChange?.(resolved);
      return resolved;
    });
  }, [onRangeChange]);

  React.useEffect(() => {
    if (!drawingManager) return;
    return drawingManager.subscribe(() => forceUpdate());
  }, [drawingManager]);

  React.useEffect(() => {
    if (!externalRange) return;
    if (externalRange.to <= externalRange.from) return;
    updateRange((current) => (
      current.from === externalRange.from && current.to === externalRange.to
        ? current
        : externalRange
    ));
  }, [externalRange, updateRange]);

  React.useEffect(() => {
    setPlacingPoints([]);
    setPreviewPoint(null);
  }, [activeDrawingTool]);

  React.useEffect(() => {
    const tickerChanged = prevTickerRef.current !== ticker;
    const prevLen = prevLenRef.current;
    prevTickerRef.current = ticker;
    prevLenRef.current = ohlc.length;

    if (tickerChanged || prevLen === 0) {
      // New instrument (or first load) — nothing to preserve, show the default window.
      updateRange(defaultRange(ohlc.length));
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
      updateRange({ from, to });
    }
  }, [ohlc.length, ticker, updateRange]);

  // Computed once per data/indicator-selection change, not per render frame —
  // `time` stays a true index into `ohlc` even after null-filtering, so
  // visibility filtering below stays correct.
  const indicatorSeries = React.useMemo(() => {
    const closes = ohlc.map((c) => c.close);
    return indicators.filter((key): key is keyof typeof INDICATOR_CONFIG => key in INDICATOR_CONFIG).map((key) => {
      const config = INDICATOR_CONFIG[key];
      const values = config.compute(closes);
      const points: LinePoint[] = [];
      values.forEach((v, i) => {
        if (v != null) points.push({ time: i, value: v });
      });
      return { key, color: config.color, points };
    });
  }, [ohlc, indicators]);

  const bollingerSeries = React.useMemo(() => {
    if (!indicators.includes("bollinger")) return null;
    const values = computeBollinger(ohlc.map((c) => c.close), 20, 2);
    const toPoints = (rows: (number | null)[]) =>
      rows.reduce<LinePoint[]>((acc, value, time) => {
        if (value != null) acc.push({ time, value });
        return acc;
      }, []);
    return {
      upper: toPoints(values.upper),
      middle: toPoints(values.middle),
      lower: toPoints(values.lower),
    };
  }, [ohlc, indicators]);

  const vwapSeries = React.useMemo(() => {
    if (!indicators.includes("vwap")) return [];
    const values = computeVWAP(
      ohlc.map((c) => c.high),
      ohlc.map((c) => c.low),
      ohlc.map((c) => c.close),
      ohlc.map((c) => c.volume)
    );
    return values.reduce<LinePoint[]>((acc, value, time) => {
      if (value != null) acc.push({ time, value });
      return acc;
    }, []);
  }, [ohlc, indicators]);

  const ichimokuSeries = React.useMemo(() => {
    if (!indicators.includes("ichimoku")) return null;
    const values = computeIchimoku(
      ohlc.map((c) => c.high),
      ohlc.map((c) => c.low),
      ohlc.map((c) => c.close)
    );
    return {
      tenkan: toLinePoints(values.tenkan),
      kijun: toLinePoints(values.kijun),
      senkouA: toLinePoints(values.senkouA),
      senkouB: toLinePoints(values.senkouB),
      chikou: toLinePoints(values.chikou),
    };
  }, [ohlc, indicators]);

  const superTrendSeries = React.useMemo(() => {
    if (!indicators.includes("superTrend")) return null;
    const values = computeSuperTrend(
      ohlc.map((c) => c.high),
      ohlc.map((c) => c.low),
      ohlc.map((c) => c.close),
      10,
      3
    );
    const bullish: LinePoint[] = [];
    const bearish: LinePoint[] = [];
    values.superTrend.forEach((value, time) => {
      if (value == null || !Number.isFinite(value)) return;
      const point = { time, value };
      if (values.direction[time] === -1) bearish.push(point);
      else bullish.push(point);
    });
    return { bullish, bearish };
  }, [ohlc, indicators]);

  const render = React.useCallback(
    ({ ctx, width, height: h, dpr }: { ctx: CanvasRenderingContext2D; width: number; height: number; dpr: number }) => {
      widthRef.current = width;
      if (ohlc.length === 0) return;
      const priceAreaHeight = h - PADDING.bottom - PADDING.top - VOLUME_HEIGHT;
      const pricePadding = { ...PADDING, bottom: PADDING.bottom + VOLUME_HEIGHT };

      let yDomain: [number, number];
      if (chartType === "heikinAshi") {
        yDomain = heikinAshiYDomain(ohlc, range);
      } else if (chartType === "line" || chartType === "area") {
        const visibleCloses = ohlc.slice(Math.max(0, range.from), Math.min(ohlc.length, range.to)).map((c) => c.close);
        if (visibleCloses.length === 0) yDomain = [0, 1];
        else {
          let cMin = Infinity;
          let cMax = -Infinity;
          for (const v of visibleCloses) {
            if (v < cMin) cMin = v;
            if (v > cMax) cMax = v;
          }
          if (cMin === cMax) { cMin -= 1; cMax += 1; }
          const pad = (cMax - cMin) * 0.08;
          yDomain = [cMin - pad, cMax + pad];
        }
      } else if (chartType === "baseline") {
        const visibleCloses = ohlc.slice(Math.max(0, range.from), Math.min(ohlc.length, range.to)).map((c) => c.close);
        if (visibleCloses.length === 0) yDomain = [0, 1];
        else {
          let cMin = Infinity;
          let cMax = -Infinity;
          for (const v of visibleCloses) {
            if (v < cMin) cMin = v;
            if (v > cMax) cMax = v;
          }
          if (cMin === cMax) { cMin -= 1; cMax += 1; }
          const pad = (cMax - cMin) * 0.08;
          yDomain = [cMin - pad, cMax + pad];
        }
      } else {
        yDomain = candlestickYDomain(ohlc, range);
      }

      drawGrid({ ctx, width, height: h, dpr, padding: pricePadding });

      if (showVolumeProfile) {
        const buckets = computeVolumeProfile(ohlc, range);
        drawVolumeProfile({ ctx, buckets, width, padding: pricePadding, yDomain, priceAreaHeight });
      }

      const [yMin, yMax] = yDomain;
      const ySpan = yMax - yMin || 1;
      const plotH = priceAreaHeight;
      const yScaleFn = (v: number) => pricePadding.top + plotH * (1 - (v - yMin) / ySpan);
      const visibleCount = Math.max(1, range.to - range.from);
      const candleWidth = Math.min(12, (width - pricePadding.left - pricePadding.right) / visibleCount);
      const xScaleFn = (i: number) => pricePadding.left + (i - range.from + 0.5) * candleWidth;

      if (chartType === "candlestick") {
        drawCandlestickSeries({ ctx, data: ohlc, visibleRange: range, width, height: h, dpr, padding: pricePadding, yDomain });
      } else if (chartType === "heikinAshi") {
        const haData = computeHeikinAshi(ohlc);
        drawHeikinAshiSeries(ctx, haData, range, yScaleFn, xScaleFn, candleWidth, dpr);
      } else if (chartType === "hollowCandlestick") {
        drawHollowCandlestickSeries(ctx, ohlc, range, yScaleFn, xScaleFn, candleWidth, dpr);
      } else if (chartType === "line" || chartType === "area") {
        const visibleCandles = ohlc.slice(Math.max(0, range.from), Math.min(ohlc.length, range.to));
        if (visibleCandles.length > 1) {
          const points: LinePoint[] = visibleCandles.map((c, i) => ({ time: range.from + i, value: c.close }));
          drawLineSeries({
            ctx,
            data: points,
            width,
            height: h,
            padding: pricePadding,
            yDomain,
            color: "#22c55e",
            lineWidth: 1.5,
            fill: chartType === "area" ? "#22c55e" : undefined,
          });
        }
      } else if (chartType === "baseline") {
        const visibleCandles = ohlc.slice(Math.max(0, range.from), Math.min(ohlc.length, range.to));
        if (visibleCandles.length > 1) {
          const midIdx = Math.floor(visibleCandles.length / 2);
          const baselineValue = visibleCandles[midIdx].close;
          drawBaselineSeries(ctx, ohlc, range, yScaleFn, xScaleFn, baselineValue, width, h, pricePadding);
        }
      } else if (chartType === "ohlcBar") {
        const visible = ohlc.slice(Math.max(0, range.from), Math.min(ohlc.length, range.to));
        ctx.save();
        for (let i = 0; i < visible.length; i++) {
          const c = visible[i];
          const globalIndex = range.from + i;
          const x = xScaleFn(globalIndex);
          const isUp = c.close >= c.open;
          const color = isUp ? "#22c55e" : "#ef4444";
          const tickLen = Math.max(3, candleWidth * 0.3);
          const hiY = yScaleFn(c.high);
          const loY = yScaleFn(c.low);
          const opY = yScaleFn(c.open);
          const clY = yScaleFn(c.close);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          const wickX = alignToDevicePixel(x, 1, dpr);
          ctx.beginPath();
          ctx.moveTo(wickX, hiY);
          ctx.lineTo(wickX, loY);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - tickLen, opY);
          ctx.lineTo(x, opY);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, clY);
          ctx.lineTo(x + tickLen, clY);
          ctx.stroke();
        }
        ctx.restore();
      }

      indicatorSeries.forEach(({ color, points }) => {
        const visiblePoints = points.filter((p) => p.time >= range.from && p.time < range.to);
        if (visiblePoints.length > 1) {
          drawLineSeries({ ctx, data: visiblePoints, width, height: h, padding: pricePadding, yDomain, color, lineWidth: 1.25 });
        }
      });

      if (bollingerSeries) {
        [
          { points: bollingerSeries.upper, color: "#a78bfa", width: 1 },
          { points: bollingerSeries.middle, color: "#a78bfa88", width: 1 },
          { points: bollingerSeries.lower, color: "#a78bfa", width: 1 },
        ].forEach((band) => {
          const visiblePoints = band.points.filter((p) => p.time >= range.from && p.time < range.to);
          if (visiblePoints.length > 1) {
            drawLineSeries({ ctx, data: visiblePoints, width, height: h, padding: pricePadding, yDomain, color: band.color, lineWidth: band.width });
          }
        });
      }

      const visibleVwap = vwapSeries.filter((p) => p.time >= range.from && p.time < range.to);
      if (visibleVwap.length > 1) {
        drawLineSeries({ ctx, data: visibleVwap, width, height: h, padding: pricePadding, yDomain, color: "#f97316", lineWidth: 1.25, dashed: [4, 3] });
      }

      if (ichimokuSeries) {
        [
          { points: ichimokuSeries.tenkan, color: "#22c55e", width: 1 },
          { points: ichimokuSeries.kijun, color: "#ef4444", width: 1 },
          { points: ichimokuSeries.senkouA, color: "#60a5fa", width: 1 },
          { points: ichimokuSeries.senkouB, color: "#c084fc", width: 1 },
          { points: ichimokuSeries.chikou, color: "#94a3b8", width: 1 },
        ].forEach((line) => {
          const visiblePoints = line.points.filter((p) => p.time >= range.from && p.time < range.to);
          if (visiblePoints.length > 1) {
            drawLineSeries({ ctx, data: visiblePoints, width, height: h, padding: pricePadding, yDomain, color: line.color, lineWidth: line.width });
          }
        });
      }

      if (superTrendSeries) {
        [
          { points: superTrendSeries.bullish, color: "#22c55e" },
          { points: superTrendSeries.bearish, color: "#ef4444" },
        ].forEach((line) => {
          const visiblePoints = line.points.filter((p) => p.time >= range.from && p.time < range.to);
          if (visiblePoints.length > 1) {
            drawLineSeries({ ctx, data: visiblePoints, width, height: h, padding: pricePadding, yDomain, color: line.color, lineWidth: 1.35 });
          }
        });
      }

      if (drawingManager) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(pricePadding.left, pricePadding.top, width - pricePadding.left - pricePadding.right, priceAreaHeight);
        ctx.clip();

        const drawings = drawingManager.getDrawings();
        for (const d of drawings) {
          renderDrawing(ctx, d, xScaleFn, yScaleFn, width, h, ohlc);
        }

        if (placingPoints.length > 0 && previewPoint && activeDrawingTool) {
          const previewDrawing: Drawing = {
            id: "__preview__",
            type: activeDrawingTool,
            points: [...placingPoints, previewPoint],
            state: "placing",
            style: DEFAULT_DRAWING_STYLE,
          };
          renderDrawing(ctx, previewDrawing, xScaleFn, yScaleFn, width, h, ohlc);
        }

        ctx.restore();
      }

      if (events.length > 0) {
        renderEventMarkers({
          ctx,
          events,
          range,
          xScaleFn,
          chartTop: PADDING.top,
          chartHeight: priceAreaHeight,
          candleWidth,
          dpr,
        });
      }

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

      if (hover && !activeDrawingTool) {
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
    [ohlc, range, hover, data, indicatorSeries, bollingerSeries, vwapSeries, ichimokuSeries, superTrendSeries, showVolumeProfile, chartType, drawingManager, placingPoints, previewPoint, activeDrawingTool, events]
  );

  function handleWheel(deltaY: number, x: number) {
    const plotW = Math.max(1, widthRef.current - PADDING.left - PADDING.right);
    const frac = Math.max(0, Math.min(1, (x - PADDING.left) / plotW));
    updateRange((prev) => zoomRange(prev, ohlc.length, deltaY > 0 ? 1.1 : 1 / 1.1, frac));
  }

  function handlePointerDown(x: number, y: number, shiftKey: boolean) {
    if (replayPickMode && onReplayPointSelect) {
      const pricePadding = { ...PADDING, bottom: PADDING.bottom + VOLUME_HEIGHT };
      const visibleCount = Math.max(1, range.to - range.from);
      const candleWidth = Math.min(12, (widthRef.current - pricePadding.left - pricePadding.right) / visibleCount);
      const localIndex = Math.max(
        0,
        Math.min(ohlc.length - 1, Math.round((x - pricePadding.left) / candleWidth + range.from - 0.5))
      );
      const item = data[localIndex];
      if (item) {
        onReplayPointSelect(localIndex, item);
      }
      return;
    }

    if (activeDrawingTool && drawingManager) {
      const priceAreaHeight = height - PADDING.bottom - PADDING.top - VOLUME_HEIGHT;
      const pricePadding = { ...PADDING, bottom: PADDING.bottom + VOLUME_HEIGHT };
      const yDomain = candlestickYDomain(ohlc, range);
      const [yMin, yMax] = yDomain;
      const ySpan = yMax - yMin || 1;
      const plotH = priceAreaHeight;
      const yScaleFn = (v: number) => pricePadding.top + plotH * (1 - (v - yMin) / ySpan);
      const visibleCount = Math.max(1, range.to - range.from);
      const candleWidth = Math.min(12, (widthRef.current - pricePadding.left - pricePadding.right) / visibleCount);
      const xScaleFn = (i: number) => pricePadding.left + (i - range.from + 0.5) * candleWidth;

      const time = (x - pricePadding.left) / candleWidth + range.from - 0.5;
      const price = yMin + (1 - (y - pricePadding.top) / plotH) * ySpan;
      const pt: DrawingPoint = { time: Math.round(time), price };

      const required = getRequiredPoints(activeDrawingTool);
      const next = [...placingPoints, pt];

      if (next.length >= required) {
        const drawing: Drawing = {
          id: crypto.randomUUID(),
          type: activeDrawingTool,
          points: next,
          state: "active",
          style: { ...DEFAULT_DRAWING_STYLE },
        };
        drawingManager.addDrawing(drawing);
        setPlacingPoints([]);
      } else {
        setPlacingPoints(next);
      }
      return;
    }

    if (drawingManager) {
      const priceAreaHeight = height - PADDING.bottom - PADDING.top - VOLUME_HEIGHT;
      const pricePadding = { ...PADDING, bottom: PADDING.bottom + VOLUME_HEIGHT };
      const yDomain = candlestickYDomain(ohlc, range);
      const [yMin, yMax] = yDomain;
      const ySpan = yMax - yMin || 1;
      const plotH = priceAreaHeight;
      const yScaleFn = (v: number) => pricePadding.top + plotH * (1 - (v - yMin) / ySpan);
      const visibleCount = Math.max(1, range.to - range.from);
      const candleWidth = Math.min(12, (widthRef.current - pricePadding.left - pricePadding.right) / visibleCount);
      const xScaleFn = (i: number) => pricePadding.left + (i - range.from + 0.5) * candleWidth;

      const hit = drawingManager.hitTest(x, y, xScaleFn, yScaleFn);
      if (hit) {
        drawingManager.selectDrawing(hit.id);
        return;
      }
      drawingManager.selectDrawing(null);
    }

    if (!shiftKey) {
      isPanning.current = true;
      panStartX.current = x;
      panStartRange.current = range;
    }
  }

  function handlePointerMove(x: number, y: number) {
    setHover({ x, y });

    if (events.length > 0) {
      const priceAreaHeight = height - PADDING.bottom - PADDING.top - VOLUME_HEIGHT;
      const pricePadding = { ...PADDING, bottom: PADDING.bottom + VOLUME_HEIGHT };
      const yDomain = candlestickYDomain(ohlc, range);
      const [yMin, yMax] = yDomain;
      const ySpan = yMax - yMin || 1;
      const plotH = priceAreaHeight;
      const visibleCount = Math.max(1, range.to - range.from);
      const cw = Math.min(12, (widthRef.current - pricePadding.left - pricePadding.right) / visibleCount);
      const xFn = (i: number) => pricePadding.left + (i - range.from + 0.5) * cw;
      const hit = hitTestEvent(x, y, events, range, xFn, PADDING.top);
      if (hit) {
        setHoveredEvent(hit);
        setHoveredEventPos({ x, y });
        return;
      }
      setHoveredEvent(null);
      setHoveredEventPos(null);
    }

    if (activeDrawingTool && drawingManager && placingPoints.length > 0) {
      const priceAreaHeight = height - PADDING.bottom - PADDING.top - VOLUME_HEIGHT;
      const pricePadding = { ...PADDING, bottom: PADDING.bottom + VOLUME_HEIGHT };
      const yDomain = candlestickYDomain(ohlc, range);
      const [yMin, yMax] = yDomain;
      const ySpan = yMax - yMin || 1;
      const plotH = priceAreaHeight;
      const visibleCount = Math.max(1, range.to - range.from);
      const candleWidth = Math.min(12, (widthRef.current - pricePadding.left - pricePadding.right) / visibleCount);
      const time = (x - pricePadding.left) / candleWidth + range.from - 0.5;
      const price = yMin + (1 - (y - pricePadding.top) / plotH) * ySpan;
      setPreviewPoint({ time: Math.round(time), price });
      return;
    }

    if (isPanning.current) {
      const span = panStartRange.current.to - panStartRange.current.from;
      const plotW = Math.max(1, widthRef.current - PADDING.left - PADDING.right);
      const deltaCandles = Math.round(((panStartX.current - x) / plotW) * span);
      updateRange(panRange(panStartRange.current, ohlc.length, deltaCandles));
    }
  }

  if (loading) return <Skeleton height={height} className="w-full" />;
  if (error) return <ErrorState message="Could not load price history." onRetry={onRetry} />;
  if (ohlc.length === 0) return <EmptyState title={`No trading data yet for ${ticker}.`} />;

  return (
    <div style={{ position: "relative" }}>
      <ChartSurface
        height={height}
        padding={PADDING}
        onWheel={handleWheel}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          setHover(null);
          setHoveredEvent(null);
          setHoveredEventPos(null);
          isPanning.current = false;
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={() => (isPanning.current = false)}
        onDoubleClick={() => updateRange(defaultRange(ohlc.length))}
      >
        {render}
      </ChartSurface>
      {replayPickMode && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            border: "1px solid rgba(62,111,224,0.65)",
            background: "linear-gradient(180deg, rgba(62,111,224,0.08), rgba(62,111,224,0.02))",
          }}
        />
      )}
      {hoveredEvent && hoveredEventPos && (
        <EventMarkerTooltip event={hoveredEvent} x={hoveredEventPos.x} y={hoveredEventPos.y} />
      )}
    </div>
  );
}

export { INDICATOR_CONFIG };
