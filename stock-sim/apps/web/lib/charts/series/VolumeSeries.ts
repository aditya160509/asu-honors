import type { OHLC, VisibleRange } from "@/lib/charts/types";

export interface VolumeSeriesDrawArgs {
  ctx: CanvasRenderingContext2D;
  data: OHLC[];
  visibleRange: VisibleRange;
  width: number;
  panelTop: number;
  panelHeight: number;
  padding: { left: number; right: number };
  upColor?: string;
  downColor?: string;
}

/** Renders volume bars in a dedicated panel below the price chart, colored by close direction. */
export function drawVolumeSeries({
  ctx,
  data,
  visibleRange,
  width,
  panelTop,
  panelHeight,
  padding,
  upColor = "#22c55e20",
  downColor = "#ef444420",
}: VolumeSeriesDrawArgs): void {
  const { from, to } = visibleRange;
  const visible = data.slice(Math.max(0, from), Math.min(data.length, to));
  if (visible.length === 0) return;

  const plotW = width - padding.left - padding.right;
  const visibleCount = Math.max(1, to - from);
  const barWidth = Math.min(12, plotW / visibleCount);
  const bodyWidth = Math.max(1, barWidth * 0.8);

  let maxVolume = 0;
  for (const c of visible) if (c.volume > maxVolume) maxVolume = c.volume;
  if (maxVolume === 0) return;

  ctx.save();
  visible.forEach((candle, i) => {
    const globalIndex = from + i;
    const x = padding.left + (globalIndex - from + 0.5) * barWidth;
    const prevClose = globalIndex > 0 ? data[globalIndex - 1]?.close : candle.open;
    const isUp = candle.close >= (prevClose ?? candle.open);
    const barHeight = (candle.volume / maxVolume) * panelHeight;
    ctx.fillStyle = isUp ? upColor : downColor;
    ctx.fillRect(x - bodyWidth / 2, panelTop + panelHeight - barHeight, bodyWidth, barHeight);
  });
  ctx.restore();
}
