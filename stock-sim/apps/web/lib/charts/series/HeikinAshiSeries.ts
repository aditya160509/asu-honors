import type { OHLC, VisibleRange } from "@/lib/charts/types";
import { computeHeikinAshi, drawHeikinAshiSeries, heikinAshiYDomain } from "@/lib/charts/series/HeikinAshi";

export function drawHeikinAshiChart(
  ctx: CanvasRenderingContext2D,
  data: OHLC[],
  range: VisibleRange,
  yScale: (v: number) => number,
  xScale: (i: number) => number,
  barWidth: number,
  dpr: number,
  upColor?: string,
  downColor?: string
): void {
  const haData = computeHeikinAshi(data);
  drawHeikinAshiSeries(ctx, haData, range, yScale, xScale, barWidth, dpr, upColor, downColor);
}

export { computeHeikinAshi, drawHeikinAshiSeries, heikinAshiYDomain };
