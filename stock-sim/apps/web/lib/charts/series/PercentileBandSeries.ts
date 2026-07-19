import type { VisibleRange } from "@/lib/charts/types";

export interface PercentileBand {
  time: number;
  low: number;
  high: number;
}

export interface PercentileBandSeriesDrawArgs {
  ctx: CanvasRenderingContext2D;
  band: PercentileBand[];
  visibleRange?: VisibleRange;
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  yDomain: [number, number];
  fill?: string;
  opacity?: number;
}

/** Shaded region between a band's low/high series (e.g. 10th/90th percentile),
 * for a Monte Carlo ensemble fan chart. Call twice (10-90, 25-75) layered under
 * the median drawLineSeries call for a standard percentile fan. */
export function drawPercentileBandSeries({
  ctx,
  band,
  visibleRange,
  width,
  height,
  padding,
  yDomain,
  fill = "#3b82f6",
  opacity = 0.15,
}: PercentileBandSeriesDrawArgs): void {
  const visible = visibleRange ? band.slice(Math.max(0, visibleRange.from), Math.min(band.length, visibleRange.to)) : band;
  if (visible.length < 2) return;

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const [yMin, yMax] = yDomain;
  const ySpan = yMax - yMin || 1;
  const tMin = visible[0].time;
  const tMax = visible[visible.length - 1].time;
  const tSpan = tMax - tMin || 1;

  const xScale = (t: number) => padding.left + ((t - tMin) / tSpan) * plotW;
  const yScale = (v: number) => padding.top + plotH * (1 - (v - yMin) / ySpan);

  ctx.save();
  ctx.fillStyle = withOpacity(fill, opacity);
  ctx.beginPath();
  visible.forEach((p, i) => {
    const x = xScale(p.time);
    const y = yScale(p.high);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  for (let i = visible.length - 1; i >= 0; i--) {
    const p = visible[i];
    ctx.lineTo(xScale(p.time), yScale(p.low));
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function withOpacity(hexOrColor: string, opacity: number): string {
  if (hexOrColor.startsWith("#") && hexOrColor.length === 7) {
    const alpha = Math.round(opacity * 255)
      .toString(16)
      .padStart(2, "0");
    return `${hexOrColor}${alpha}`;
  }
  return hexOrColor;
}
