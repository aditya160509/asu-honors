import { alignToDevicePixel } from "@/lib/charts/core/utils";

export interface DrawGridArgs {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  padding: { top: number; right: number; bottom: number; left: number };
  rows?: number;
  cols?: number;
}

export function drawGrid({ ctx, width, height, dpr, padding, rows = 5, cols = 6 }: DrawGridArgs): void {
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  ctx.save();
  ctx.strokeStyle = "#1e1e22";
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let i = 0; i <= rows; i++) {
    const y = alignToDevicePixel(padding.top + (plotH / rows) * i, 1, dpr);
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
  }
  for (let i = 0; i <= cols; i++) {
    const x = alignToDevicePixel(padding.left + (plotW / cols) * i, 1, dpr);
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
  }
  ctx.stroke();
  ctx.restore();
}
