"use client";

import * as React from "react";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import { drawGrid } from "@/lib/charts/core/Grid";
import { drawCrosshair } from "@/lib/charts/core/Crosshair";
import { drawLineSeries, lineYDomain } from "@/lib/charts/series/LineSeries";
import { alignToDevicePixel } from "@/lib/charts/core/utils";
import type { IndicatorType } from "@/lib/charts/indicators";
import type { PriceHistoryItem } from "@/lib/api/types";
import type { VisibleRange, LinePoint, OHLC } from "@/lib/charts/types";
import {
  computeRSI,
  computeMACD,
  computeStochastic,
  computeADX,
  computeOBV,
  computeCCI,
  computeWilliamsR,
  computeMFI,
  computeCMF,
  computeROC,
} from "@/lib/charts/indicators";

const PADDING = { top: 6, right: 56, bottom: 4, left: 8 };

interface SubChartConfig {
  label: string;
  range?: [number, number];
  refLines?: { value: number; color?: string }[];
}

const SUB_CHART_CONFIGS: Record<string, SubChartConfig> = {
  rsi: { label: "RSI", range: [0, 100], refLines: [{ value: 30, color: "#ef444466" }, { value: 70, color: "#22c55e66" }] },
  macd: { label: "MACD", refLines: [{ value: 0, color: "#ffffff15" }] },
  stochastic: { label: "Stoch", range: [0, 100], refLines: [{ value: 20, color: "#ef444466" }, { value: 80, color: "#22c55e66" }] },
  adx: { label: "ADX", range: [0, 100] },
  obv: { label: "OBV" },
  cci: { label: "CCI", refLines: [{ value: -100, color: "#ef444466" }, { value: 100, color: "#22c55e66" }, { value: 0, color: "#ffffff15" }] },
  williamsR: { label: "%R", range: [0, -100], refLines: [{ value: -20, color: "#22c55e66" }, { value: -80, color: "#ef444466" }] },
  mfi: { label: "MFI", range: [0, 100], refLines: [{ value: 20, color: "#ef444466" }, { value: 80, color: "#22c55e66" }] },
  cmf: { label: "CMF", range: [-1, 1], refLines: [{ value: 0, color: "#ffffff15" }] },
  roc: { label: "ROC", refLines: [{ value: 0, color: "#ffffff15" }] },
  volume: { label: "Vol" },
};

export type SubChartIndicatorType = IndicatorType | "volume";

export interface IndicatorSubChartProps {
  type: SubChartIndicatorType;
  data: PriceHistoryItem[];
  height?: number;
  colors?: string[];
  hoverX?: number | null;
  range: VisibleRange;
  onPointerMove?: (x: number) => void;
  onPointerLeave?: () => void;
}

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

function renderMACD(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  data: PriceHistoryItem[],
  range: VisibleRange,
  colors: string[]
) {
  const closes = data.map((d) => d.close);
  const result = computeMACD(closes);

  const macdPoints: LinePoint[] = [];
  const signalPoints: LinePoint[] = [];
  const histogram: { time: number; value: number }[] = [];

  for (let i = 0; i < result.macd.length; i++) {
    if (result.macd[i] != null && i >= range.from && i < range.to) {
      macdPoints.push({ time: i, value: result.macd[i]! });
    }
    if (result.signal[i] != null && i >= range.from && i < range.to) {
      signalPoints.push({ time: i, value: result.signal[i]! });
    }
    if (result.histogram[i] != null && i >= range.from && i < range.to) {
      histogram.push({ time: i, value: result.histogram[i]! });
    }
  }

  let min = Infinity;
  let max = -Infinity;
  for (const p of macdPoints) { if (p.value < min) min = p.value; if (p.value > max) max = p.value; }
  for (const p of signalPoints) { if (p.value < min) min = p.value; if (p.value > max) max = p.value; }
  for (const h of histogram) { if (h.value < min) min = h.value; if (h.value > max) max = h.value; }
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.1;
  const yDomain: [number, number] = [min - pad, max + pad];

  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;
  const ySpan = yDomain[1] - yDomain[0] || 1;
  const visibleCount = Math.max(1, range.to - range.from);
  const candleWidth = Math.min(12, plotW / visibleCount);
  const barWidth = Math.max(1, candleWidth * 0.6);

  ctx.save();
  for (const h of histogram) {
    const x = PADDING.left + ((h.time - range.from + 0.5) / visibleCount) * plotW;
    const y0 = PADDING.top + plotH * (1 - (0 - yDomain[0]) / ySpan);
    const y1 = PADDING.top + plotH * (1 - (h.value - yDomain[0]) / ySpan);
    ctx.fillStyle = h.value >= 0 ? "#22c55e88" : "#ef444488";
    ctx.fillRect(x - barWidth / 2, Math.min(y0, y1), barWidth, Math.abs(y1 - y0));
  }
  ctx.restore();

  if (macdPoints.length > 1) {
    drawLineSeries({ ctx, data: macdPoints, width, height, padding: PADDING, yDomain, color: colors[0] ?? "#3b82f6", lineWidth: 1.25 });
  }
  if (signalPoints.length > 1) {
    drawLineSeries({ ctx, data: signalPoints, width, height, padding: PADDING, yDomain, color: colors[1] ?? "#ef4444", lineWidth: 1.25 });
  }

  drawRefLine(ctx, width, height, dpr, 0, yDomain, plotW, plotH, "#ffffff15");
  return yDomain;
}

function renderVolume(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ohlc: OHLC[],
  range: VisibleRange
) {
  const visible = ohlc.slice(Math.max(0, range.from), Math.min(ohlc.length, range.to));
  if (visible.length === 0) return [0, 1] as [number, number];

  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;
  const visibleCount = Math.max(1, range.to - range.from);
  const barWidth = Math.min(12, plotW / visibleCount);
  const bodyWidth = Math.max(1, barWidth * 0.8);

  let maxVolume = 0;
  for (const c of visible) if (c.volume > maxVolume) maxVolume = c.volume;
  if (maxVolume === 0) return [0, 1] as [number, number];

  ctx.save();
  for (let i = 0; i < visible.length; i++) {
    const candle = visible[i];
    const globalIndex = range.from + i;
    const x = PADDING.left + ((i + 0.5) / visibleCount) * plotW;
    const prevClose = globalIndex > 0 ? ohlc[globalIndex - 1]?.close : candle.open;
    const isUp = candle.close >= (prevClose ?? candle.open);
    const barHeight = (candle.volume / maxVolume) * plotH;
    ctx.fillStyle = isUp ? "#22c55e30" : "#ef444430";
    ctx.fillRect(x - bodyWidth / 2, PADDING.top + plotH - barHeight, bodyWidth, barHeight);
  }
  ctx.restore();

  return [0, maxVolume] as [number, number];
}

function renderSingleLine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  values: (number | null)[],
  range: VisibleRange,
  color: string,
  fixedDomain?: [number, number]
) {
  const points: LinePoint[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] != null && i >= range.from && i < range.to) {
      points.push({ time: i, value: values[i]! });
    }
  }

  if (points.length < 2) return [0, 100] as [number, number];

  let yDomain: [number, number];
  if (fixedDomain) {
    yDomain = fixedDomain;
  } else {
    yDomain = lineYDomain(points, 0.1);
  }

  drawLineSeries({ ctx, data: points, width, height, padding: PADDING, yDomain, color, lineWidth: 1.25 });
  return yDomain;
}

function renderStochastic(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  data: PriceHistoryItem[],
  range: VisibleRange,
  colors: string[]
) {
  const result = computeStochastic(data.map((d) => d.high), data.map((d) => d.low), data.map((d) => d.close));

  const kPoints: LinePoint[] = [];
  const dPoints: LinePoint[] = [];
  for (let i = 0; i < result.k.length; i++) {
    if (result.k[i] != null && i >= range.from && i < range.to) kPoints.push({ time: i, value: result.k[i]! });
    if (result.d[i] != null && i >= range.from && i < range.to) dPoints.push({ time: i, value: result.d[i]! });
  }

  const yDomain: [number, number] = [0, 100];

  if (kPoints.length > 1) drawLineSeries({ ctx, data: kPoints, width, height, padding: PADDING, yDomain, color: colors[0] ?? "#f59e0b", lineWidth: 1.25 });
  if (dPoints.length > 1) drawLineSeries({ ctx, data: dPoints, width, height, padding: PADDING, yDomain, color: colors[1] ?? "#3b82f6", lineWidth: 1.25 });

  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;
  drawRefLine(ctx, width, height, dpr, 20, yDomain, plotW, plotH, "#ef444466");
  drawRefLine(ctx, width, height, dpr, 80, yDomain, plotW, plotH, "#22c55e66");

  return yDomain;
}

function renderADX(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  data: PriceHistoryItem[],
  range: VisibleRange,
  colors: string[]
) {
  const result = computeADX(data.map((d) => d.high), data.map((d) => d.low), data.map((d) => d.close));

  const adxPoints: LinePoint[] = [];
  const plusPoints: LinePoint[] = [];
  const minusPoints: LinePoint[] = [];

  for (let i = 0; i < result.adx.length; i++) {
    if (result.adx[i] != null && i >= range.from && i < range.to) adxPoints.push({ time: i, value: result.adx[i]! });
    if (result.plusDI[i] != null && i >= range.from && i < range.to) plusPoints.push({ time: i, value: result.plusDI[i]! });
    if (result.minusDI[i] != null && i >= range.from && i < range.to) minusPoints.push({ time: i, value: result.minusDI[i]! });
  }

  const yDomain: [number, number] = [0, 100];

  if (adxPoints.length > 1) drawLineSeries({ ctx, data: adxPoints, width, height, padding: PADDING, yDomain, color: colors[0] ?? "#a78bfa", lineWidth: 1.5 });
  if (plusPoints.length > 1) drawLineSeries({ ctx, data: plusPoints, width, height, padding: PADDING, yDomain, color: colors[1] ?? "#22c55e", lineWidth: 1, dashed: [3, 3] });
  if (minusPoints.length > 1) drawLineSeries({ ctx, data: minusPoints, width, height, padding: PADDING, yDomain, color: colors[2] ?? "#ef4444", lineWidth: 1, dashed: [3, 3] });

  return yDomain;
}

function renderCMF(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  data: PriceHistoryItem[],
  range: VisibleRange,
  colors: string[]
) {
  const values = computeCMF(data.map((d) => d.high), data.map((d) => d.low), data.map((d) => d.close), data.map((d) => d.volume));

  let min = Infinity;
  let max = -Infinity;
  for (let i = range.from; i < range.to && i < values.length; i++) {
    if (values[i] != null) {
      if (values[i]! < min) min = values[i]!;
      if (values[i]! > max) max = values[i]!;
    }
  }
  if (min === Infinity) { min = -1; max = 1; }
  if (min === max) { min -= 0.1; max += 0.1; }
  const pad = (max - min) * 0.1;
  const yDomain: [number, number] = [min - pad, max + pad];

  const points: LinePoint[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] != null && i >= range.from && i < range.to) {
      points.push({ time: i, value: values[i]! });
    }
  }

  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;
  const ySpan = yDomain[1] - yDomain[0] || 1;
  const visibleCount = Math.max(1, range.to - range.from);
  const barWidth = Math.min(12, plotW / visibleCount);

  ctx.save();
  for (const p of points) {
    const x = PADDING.left + ((p.time - range.from + 0.5) / visibleCount) * plotW;
    const y0 = PADDING.top + plotH * (1 - (0 - yDomain[0]) / ySpan);
    const y1 = PADDING.top + plotH * (1 - (p.value - yDomain[0]) / ySpan);
    ctx.fillStyle = p.value >= 0 ? "#22c55e66" : "#ef444466";
    ctx.fillRect(x - barWidth / 2, Math.min(y0, y1), barWidth, Math.abs(y1 - y0));
  }
  ctx.restore();

  drawRefLine(ctx, width, height, dpr, 0, yDomain, plotW, plotH, "#ffffff15");
  return yDomain;
}

function renderCrosshair(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  x: number
) {
  if (x < PADDING.left || x > width - PADDING.right) return;

  ctx.save();
  ctx.strokeStyle = "#ffffff22";
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  const xAligned = alignToDevicePixel(x, 1, dpr);
  ctx.moveTo(xAligned, PADDING.top);
  ctx.lineTo(xAligned, height - PADDING.bottom);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawRefLine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  value: number,
  yDomain: [number, number],
  plotW: number,
  plotH: number,
  color: string
) {
  const ySpan = yDomain[1] - yDomain[0] || 1;
  const yFrac = (value - yDomain[0]) / ySpan;
  if (yFrac < 0 || yFrac > 1) return;
  const y = alignToDevicePixel(PADDING.top + plotH * (1 - yFrac), 1, dpr);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(PADDING.left, y);
  ctx.lineTo(width - PADDING.right, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawYLabels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  yDomain: [number, number],
  ticks: number = 4
) {
  const plotH = height - PADDING.top - PADDING.bottom;
  ctx.save();
  ctx.fillStyle = "#5c5c62";
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= ticks; i++) {
    const t = i / ticks;
    const value = yDomain[1] - t * (yDomain[1] - yDomain[0]);
    const y = PADDING.top + plotH * t;
    ctx.fillText(value.toFixed(2), width - 6, y);
  }
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string) {
  ctx.save();
  ctx.fillStyle = "#5c5c62";
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(text, PADDING.left + 4, PADDING.top + 2);
  ctx.restore();
}

export function IndicatorSubChart({
  type,
  data,
  height = 100,
  colors = [],
  hoverX,
  range,
  onPointerMove,
  onPointerLeave,
}: IndicatorSubChartProps) {
  const ohlc = React.useMemo(() => toOHLC(data), [data]);
  const config = SUB_CHART_CONFIGS[type];

  const render = React.useCallback(
    ({ ctx, width, height: h, dpr }: { ctx: CanvasRenderingContext2D; width: number; height: number; dpr: number }) => {
      if (ohlc.length === 0) return;

      drawGrid({ ctx, width, height: h, dpr, padding: PADDING, rows: 3, cols: 6 });

      let yDomain: [number, number] = [0, 100];

      if (type === "volume") {
        yDomain = renderVolume(ctx, width, h, ohlc, range);
      } else if (type === "macd") {
        yDomain = renderMACD(ctx, width, h, dpr, data, range, colors);
      } else if (type === "stochastic") {
        yDomain = renderStochastic(ctx, width, h, dpr, data, range, colors);
      } else if (type === "adx") {
        yDomain = renderADX(ctx, width, h, dpr, data, range, colors);
      } else if (type === "cmf") {
        yDomain = renderCMF(ctx, width, h, dpr, data, range, colors);
      } else {
        const values = (() => {
          const closes = data.map((d) => d.close);
          const highs = data.map((d) => d.high);
          const lows = data.map((d) => d.low);
          switch (type) {
            case "rsi": return computeRSI(closes, 14);
            case "obv": return computeOBV(closes, data.map((d) => d.volume));
            case "cci": return computeCCI(highs, lows, closes, 20);
            case "williamsR": return computeWilliamsR(highs, lows, closes, 14);
            case "mfi": return computeMFI(highs, lows, closes, data.map((d) => d.volume), 14);
            case "roc": return computeROC(closes, 12);
            default: return [];
          }
        })();

        const fixedDomain = config?.range as [number, number] | undefined;
        yDomain = renderSingleLine(ctx, width, h, dpr, values, range, colors[0] ?? "#a78bfa", fixedDomain);

        const plotW = width - PADDING.left - PADDING.right;
        const plotH = h - PADDING.top - PADDING.bottom;
        if (config?.refLines) {
          for (const ref of config.refLines) {
            drawRefLine(ctx, width, h, dpr, ref.value, yDomain, plotW, plotH, ref.color ?? "#ffffff15");
          }
        }
      }

      drawYLabels(ctx, width, h, yDomain);
      drawLabel(ctx, config?.label ?? type);

      if (hoverX != null) {
        renderCrosshair(ctx, width, h, dpr, hoverX);
      }
    },
    [ohlc, data, range, type, colors, hoverX, config]
  );

  function handlePointerMove(x: number) {
    onPointerMove?.(x);
  }

  return (
    <ChartSurface
      height={height}
      padding={PADDING}
      onPointerMove={handlePointerMove}
      onPointerLeave={onPointerLeave}
    >
      {render}
    </ChartSurface>
  );
}
