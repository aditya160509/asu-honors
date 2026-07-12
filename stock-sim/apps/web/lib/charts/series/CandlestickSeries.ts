import type { OHLC, VisibleRange } from "@/lib/charts/types";
import { alignToDevicePixel } from "@/lib/charts/core/utils";

export interface CandlestickDrawArgs {
  ctx: CanvasRenderingContext2D;
  data: OHLC[];
  visibleRange: VisibleRange;
  width: number;
  height: number;
  dpr: number;
  padding: { top: number; right: number; bottom: number; left: number };
  yDomain: [number, number];
  upColor?: string;
  downColor?: string;
}

const MAX_CANDLE_WIDTH = 12;
const AREA_MODE_THRESHOLD = 3;

/**
 * Renders OHLC candles for the visible range.
 * Falls back to an area/line style when candleWidth < 3px (too dense to read as candles).
 */
export function drawCandlestickSeries({
  ctx,
  data,
  visibleRange,
  width,
  height,
  dpr,
  padding,
  yDomain,
  upColor = "#22c55e",
  downColor = "#ef4444",
}: CandlestickDrawArgs): void {
  const { from, to } = visibleRange;
  const visible = data.slice(Math.max(0, from), Math.min(data.length, to));
  if (visible.length === 0) return;

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const visibleCount = Math.max(1, to - from);
  const candleWidth = Math.min(MAX_CANDLE_WIDTH, plotW / visibleCount);
  const bodyWidth = Math.max(1, candleWidth * 0.8);

  const [yMin, yMax] = yDomain;
  const ySpan = yMax - yMin || 1;
  const yScale = (v: number) => padding.top + plotH * (1 - (v - yMin) / ySpan);
  const xScale = (i: number) => padding.left + (i - from + 0.5) * candleWidth;

  if (candleWidth < AREA_MODE_THRESHOLD) {
    drawAreaFallback(ctx, visible, from, xScale, yScale, upColor);
    return;
  }

  ctx.save();
  for (let i = 0; i < visible.length; i++) {
    const candle = visible[i];
    const globalIndex = from + i;
    const x = xScale(globalIndex);
    const isUp = candle.close >= candle.open;
    const color = isUp ? upColor : downColor;

    const wickX = alignToDevicePixel(x, 1, dpr);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wickX, yScale(candle.high));
    ctx.lineTo(wickX, yScale(candle.low));
    ctx.stroke();

    const openY = yScale(candle.open);
    const closeY = yScale(candle.close);
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(1, Math.abs(closeY - openY));

    ctx.fillStyle = color;
    if (candle.open === candle.close) {
      const dashY = alignToDevicePixel(openY, 1, dpr);
      ctx.beginPath();
      ctx.moveTo(x - bodyWidth / 2, dashY);
      ctx.lineTo(x + bodyWidth / 2, dashY);
      ctx.strokeStyle = color;
      ctx.stroke();
    } else {
      ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    }
  }
  ctx.restore();
}

function drawAreaFallback(
  ctx: CanvasRenderingContext2D,
  visible: OHLC[],
  from: number,
  xScale: (i: number) => number,
  yScale: (v: number) => number,
  color: string
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  visible.forEach((candle, i) => {
    const x = xScale(from + i);
    const y = yScale(candle.close);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

/** Computes a padded price domain (min low / max high) across the visible candles. */
export function candlestickYDomain(data: OHLC[], visibleRange: VisibleRange, padPct = 0.08): [number, number] {
  const visible = data.slice(Math.max(0, visibleRange.from), Math.min(data.length, visibleRange.to));
  if (visible.length === 0) return [0, 1];
  let min = Infinity;
  let max = -Infinity;
  for (const c of visible) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * padPct;
  return [min - pad, max + pad];
}
