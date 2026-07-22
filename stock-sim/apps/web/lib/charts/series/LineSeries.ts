import type { LinePoint, VisibleRange } from "@/lib/charts/types";

export interface LineSeriesDrawArgs {
  ctx: CanvasRenderingContext2D;
  data: LinePoint[];
  visibleRange?: VisibleRange;
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  yDomain: [number, number];
  color?: string;
  lineWidth?: number;
  dashed?: [number, number];
  fill?: string; // area fill color (top), fades to transparent
  // Overrides the auto-derived [tMin, tMax] (normally each series' own first/
  // last point.time) with a shared domain. Required whenever multiple
  // series of DIFFERENT LENGTHS are drawn on one shared x-axis (e.g. a
  // Future Lab timeline comparison, where a branch may have far fewer
  // points than the timeline it forked from) -- without this, each series
  // independently stretches to fill the full plot width using only its own
  // point count, so a hover lookup that indexes by shared array index (see
  // hoverLookup.ts/nearestIndexForX) reads a value whose pixel position
  // doesn't match the cursor for any series shorter than the longest one.
  timeDomain?: [number, number];
}

/** Monotone-x-style smoothed line (Catmull-Rom-ish midpoint smoothing), with optional area fill. */
export function drawLineSeries({
  ctx,
  data,
  visibleRange,
  width,
  height,
  padding,
  yDomain,
  color = "#22c55e",
  lineWidth = 1.5,
  dashed,
  fill,
  timeDomain,
}: LineSeriesDrawArgs): void {
  const visible = visibleRange ? data.slice(Math.max(0, visibleRange.from), Math.min(data.length, visibleRange.to)) : data;
  if (visible.length === 0) return;

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const [yMin, yMax] = yDomain;
  const ySpan = yMax - yMin || 1;
  const [tMin, tMax] = timeDomain ?? [visible[0].time, visible[visible.length - 1].time];
  const tSpan = tMax - tMin || 1;

  const xScale = (t: number) => padding.left + ((t - tMin) / tSpan) * plotW;
  const yScale = (v: number) => padding.top + plotH * (1 - (v - yMin) / ySpan);

  const points = visible.map((p) => ({ x: xScale(p.time), y: yScale(p.value) }));

  ctx.save();
  if (fill && points.length > 1) {
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, withOpacity(fill, 0.3));
    gradient.addColorStop(1, withOpacity(fill, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(points[0].x, height - padding.bottom);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  if (dashed) ctx.setLineDash(dashed);
  ctx.beginPath();
  drawSmoothPath(ctx, points);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawSmoothPath(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]): void {
  if (points.length < 2) {
    if (points.length === 1) {
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[0].x, points[0].y);
    }
    return;
  }
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
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

export function lineYDomain(data: LinePoint[], padPct = 0.08): [number, number] {
  if (data.length === 0) return [0, 1];
  let min = Infinity;
  let max = -Infinity;
  for (const p of data) {
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
  }
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * padPct;
  return [min - pad, max + pad];
}
