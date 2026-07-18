import type { OHLC, VisibleRange } from "@/lib/charts/types";
import { alignToDevicePixel } from "@/lib/charts/core/utils";

const MAX_CANDLE_WIDTH = 12;

export function drawHollowCandlestickSeries(
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

    const wickX = alignToDevicePixel(x, 1, dpr);
    ctx.strokeStyle = candle.close >= candle.open ? upColor : downColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wickX, yScale(candle.high));
    ctx.lineTo(wickX, yScale(candle.low));
    ctx.stroke();

    const openY = yScale(candle.open);
    const closeY = yScale(candle.close);
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(1, Math.abs(closeY - openY));

    if (candle.close > candle.open) {
      ctx.strokeStyle = upColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    } else if (candle.close < candle.open) {
      ctx.fillStyle = downColor;
      ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    } else {
      ctx.strokeStyle = "#9ca3af";
      ctx.lineWidth = 1;
      const dashY = alignToDevicePixel(openY, 1, dpr);
      ctx.beginPath();
      ctx.moveTo(x - bodyWidth / 2, dashY);
      ctx.lineTo(x + bodyWidth / 2, dashY);
      ctx.stroke();
    }
  }
  ctx.restore();
}
