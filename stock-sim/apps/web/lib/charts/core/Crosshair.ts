import { alignToDevicePixel } from "@/lib/charts/core/utils";

export interface DrawCrosshairArgs {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  padding: { top: number; right: number; bottom: number; left: number };
  x: number;
  y: number;
}

export function drawCrosshair({ ctx, width, height, dpr, padding, x, y }: DrawCrosshairArgs): void {
  if (x < padding.left || x > width - padding.right || y < padding.top || y > height - padding.bottom) return;
  ctx.save();
  ctx.strokeStyle = "#ffffff22";
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  const xAligned = alignToDevicePixel(x, 1, dpr);
  const yAligned = alignToDevicePixel(y, 1, dpr);
  ctx.moveTo(xAligned, padding.top);
  ctx.lineTo(xAligned, height - padding.bottom);
  ctx.moveTo(padding.left, yAligned);
  ctx.lineTo(width - padding.right, yAligned);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export interface CrosshairTooltipArgs {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  lines: string[];
}

export function drawCrosshairTooltip({ ctx, x, y, lines }: CrosshairTooltipArgs): void {
  const padX = 8;
  const padY = 6;
  const lineHeight = 14;
  ctx.save();
  ctx.font = "11px 'JetBrains Mono', monospace";
  const textWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const boxW = textWidth + padX * 2;
  const boxH = lines.length * lineHeight + padY * 2;
  const boxX = Math.min(x + 12, ctx.canvas.width - boxW - 12);
  const boxY = Math.max(y - boxH - 12, 4);

  ctx.fillStyle = "#121214";
  ctx.strokeStyle = "#2a2a2e";
  ctx.lineWidth = 1;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = "#e8e8ea";
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.fillText(line, boxX + padX, boxY + padY + i * lineHeight);
  });
  ctx.restore();
}
