import type { OHLC, VisibleRange } from "@/lib/charts/types";
import { alignToDevicePixel } from "@/lib/charts/core/utils";

export function computeHeikinAshi(data: OHLC[]): OHLC[] {
  if (data.length === 0) return [];
  const result: OHLC[] = [];
  let prevHAOpen = data[0].open;
  let prevHAClose = (data[0].open + data[0].high + data[0].low + data[0].close) / 4;
  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = (prevHAOpen + prevHAClose) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    result.push({ time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose, volume: c.volume });
    prevHAOpen = haOpen;
    prevHAClose = haClose;
  }
  return result;
}

const MAX_CANDLE_WIDTH = 12;

export function drawHeikinAshiSeries(
  ctx: CanvasRenderingContext2D,
  data: OHLC[],
  range: VisibleRange,
  yScale: (v: number) => number,
  xScale: (i: number) => number,
  barWidth: number,
  dpr: number,
  upColor = "#22c55e",
  downColor = "#ef4444"
): void {
  const { from, to } = range;
  const visible = data.slice(Math.max(0, from), Math.min(data.length, to));
  if (visible.length === 0) return;

  const bodyWidth = Math.max(1, Math.min(MAX_CANDLE_WIDTH, barWidth) * 0.8);

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

export function heikinAshiYDomain(data: OHLC[], range: VisibleRange, padPct = 0.08): [number, number] {
  const visible = data.slice(Math.max(0, range.from), Math.min(data.length, range.to));
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
