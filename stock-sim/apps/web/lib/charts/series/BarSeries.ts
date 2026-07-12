/** Horizontal bar series used by DriverChart. Pure drawing helper (no React). */
export interface HorizontalBarArgs {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  trackWidth: number;
  barHeight: number;
  fraction: number; // 0..1
  color: string;
  trackColor?: string;
}

export function drawHorizontalBar({
  ctx,
  x,
  y,
  trackWidth,
  barHeight,
  fraction,
  color,
  trackColor = "#1a1a1e",
}: HorizontalBarArgs): void {
  ctx.save();
  ctx.fillStyle = trackColor;
  ctx.fillRect(x, y, trackWidth, barHeight);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, fraction)) * trackWidth, barHeight);
  ctx.restore();
}

/** Lerp from --negative to --positive based on a 0..100 score. */
export function scoreToColor(score: number): string {
  const t = Math.min(100, Math.max(0, score)) / 100;
  const neg = { r: 239, g: 68, b: 68 };
  const pos = { r: 34, g: 197, b: 94 };
  const r = Math.round(neg.r + (pos.r - neg.r) * t);
  const g = Math.round(neg.g + (pos.g - neg.g) * t);
  const b = Math.round(neg.b + (pos.b - neg.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
