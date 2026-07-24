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

/** Liquid crosshair with radial hotspot glow and gradient-faded lines. */
export function drawCrosshair({ ctx, width, height, dpr, padding, x, y }: DrawCrosshairArgs): void {
  if (x < padding.left || x > width - padding.right || y < padding.top || y > height - padding.bottom) return;
  ctx.save();

  // Radial hotspot glow at crosshair intersection
  const glowRadius = 36;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
  glow.addColorStop(0, "rgba(255,255,255,0.10)");
  glow.addColorStop(0.4, "rgba(255,255,255,0.04)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);

  // Vertical line — gradient fade toward top/bottom edges
  const vGrad = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  vGrad.addColorStop(0, "rgba(255,255,255,0)");
  vGrad.addColorStop(0.35, "rgba(255,255,255,0.14)");
  vGrad.addColorStop(0.5, "rgba(255,255,255,0.22)");
  vGrad.addColorStop(0.65, "rgba(255,255,255,0.14)");
  vGrad.addColorStop(1, "rgba(255,255,255,0)");
  const xAlign = alignToDevicePixel(x, 1, dpr);
  ctx.strokeStyle = vGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xAlign, padding.top);
  ctx.lineTo(xAlign, height - padding.bottom);
  ctx.stroke();

  // Horizontal line — gradient fade toward left/right edges
  const hGrad = ctx.createLinearGradient(padding.left, 0, width - padding.right, 0);
  hGrad.addColorStop(0, "rgba(255,255,255,0)");
  hGrad.addColorStop(0.35, "rgba(255,255,255,0.14)");
  hGrad.addColorStop(0.5, "rgba(255,255,255,0.22)");
  hGrad.addColorStop(0.65, "rgba(255,255,255,0.14)");
  hGrad.addColorStop(1, "rgba(255,255,255,0)");
  const yAlign = alignToDevicePixel(y, 1, dpr);
  ctx.strokeStyle = hGrad;
  ctx.beginPath();
  ctx.moveTo(padding.left, yAlign);
  ctx.lineTo(width - padding.right, yAlign);
  ctx.stroke();

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

  // Soft glow shadow behind tooltip
  ctx.shadowColor = "rgba(255,255,255,0.04)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#121214";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "#2a2a2e";
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = "#e8e8ea";
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.fillText(line, boxX + padX, boxY + padY + i * lineHeight);
  });
  ctx.restore();
}
