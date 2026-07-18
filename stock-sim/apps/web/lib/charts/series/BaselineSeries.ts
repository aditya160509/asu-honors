import type { OHLC, VisibleRange } from "@/lib/charts/types";

export function drawBaselineSeries(
  ctx: CanvasRenderingContext2D,
  data: OHLC[],
  range: VisibleRange,
  yScale: (v: number) => number,
  xScale: (i: number) => number,
  baselineValue: number,
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
  upColor = "#22c55e",
  downColor = "#ef4444"
): void {
  const { from, to } = range;
  const visible = data.slice(Math.max(0, from), Math.min(data.length, to));
  if (visible.length === 0) return;

  const baselineY = yScale(baselineValue);

  ctx.save();

  const abovePoints: { x: number; y: number }[] = [];
  const belowPoints: { x: number; y: number }[] = [];

  for (let i = 0; i < visible.length; i++) {
    const candle = visible[i];
    const globalIndex = from + i;
    const x = xScale(globalIndex);
    const y = yScale(candle.close);
    const pt = { x, y };
    if (candle.close >= baselineValue) {
      abovePoints.push(pt);
      belowPoints.push({ x, y: baselineY });
    } else {
      abovePoints.push({ x, y: baselineY });
      belowPoints.push(pt);
    }
  }

  if (abovePoints.length > 1) {
    const gradAbove = ctx.createLinearGradient(0, padding.top, 0, baselineY);
    gradAbove.addColorStop(0, withOpacity(upColor, 0.25));
    gradAbove.addColorStop(1, withOpacity(upColor, 0));
    ctx.fillStyle = gradAbove;
    ctx.beginPath();
    ctx.moveTo(abovePoints[0].x, baselineY);
    for (const p of abovePoints) ctx.lineTo(p.x, p.y);
    ctx.lineTo(abovePoints[abovePoints.length - 1].x, baselineY);
    ctx.closePath();
    ctx.fill();
  }

  if (belowPoints.length > 1) {
    const gradBelow = ctx.createLinearGradient(0, baselineY, 0, height - padding.bottom);
    gradBelow.addColorStop(0, withOpacity(downColor, 0));
    gradBelow.addColorStop(1, withOpacity(downColor, 0.25));
    ctx.fillStyle = gradBelow;
    ctx.beginPath();
    ctx.moveTo(belowPoints[0].x, baselineY);
    for (const p of belowPoints) ctx.lineTo(p.x, p.y);
    ctx.lineTo(belowPoints[belowPoints.length - 1].x, baselineY);
    ctx.closePath();
    ctx.fill();
  }

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let aboveSeg = false;
  let belowSeg = false;
  for (let i = 0; i < visible.length; i++) {
    const x = xScale(from + i);
    const y = yScale(visible[i].close);
    if (visible[i].close >= baselineValue) {
      if (belowSeg) {
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = upColor;
        aboveSeg = true;
        belowSeg = false;
      } else if (!aboveSeg) {
        ctx.strokeStyle = upColor;
        aboveSeg = true;
      }
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    } else {
      if (aboveSeg) {
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = downColor;
        belowSeg = true;
        aboveSeg = false;
      } else if (!belowSeg) {
        ctx.strokeStyle = downColor;
        belowSeg = true;
      }
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padding.left, baselineY);
  ctx.lineTo(width - padding.right, baselineY);
  ctx.stroke();
  ctx.setLineDash([]);

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
