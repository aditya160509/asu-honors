export interface DrawAxisArgs {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  yDomain: [number, number];
  formatY: (v: number) => string;
  ticks?: number;
}

export function drawPriceAxis({ ctx, width, height, padding, yDomain, formatY, ticks = 5 }: DrawAxisArgs): void {
  const plotH = height - padding.top - padding.bottom;
  ctx.save();
  ctx.fillStyle = "#98989e";
  ctx.font = "11px var(--font-mono), monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= ticks; i++) {
    const t = i / ticks;
    const value = yDomain[1] - t * (yDomain[1] - yDomain[0]);
    const y = padding.top + plotH * t;
    ctx.fillText(formatY(value), width - padding.right + 4, y);
  }
  ctx.restore();
}

export interface DrawTimeAxisArgs {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  labels: { x: number; text: string }[];
}

export function drawTimeAxis({ ctx, height, padding, labels }: DrawTimeAxisArgs): void {
  ctx.save();
  ctx.fillStyle = "#98989e";
  ctx.font = "11px var(--font-mono), monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const { x, text } of labels) {
    ctx.fillText(text, x, height - padding.bottom + 6);
  }
  ctx.restore();
}
