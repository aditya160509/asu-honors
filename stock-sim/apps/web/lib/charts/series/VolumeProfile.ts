import type { OHLC, VisibleRange } from "@/lib/charts/types";

/**
 * Volume-by-price histogram (VPVR), per SKILL.md §3.3: bucket the visible
 * candles' [low, high] range into equal price buckets, distributing each
 * candle's volume proportionally across the buckets it spans.
 */
export interface VolumeProfileBucket {
  priceLow: number;
  priceHigh: number;
  volume: number;
}

export function computeVolumeProfile(
  data: OHLC[],
  visibleRange: VisibleRange,
  bucketCount = 40
): VolumeProfileBucket[] {
  const visible = data.slice(Math.max(0, visibleRange.from), Math.min(data.length, visibleRange.to));
  if (visible.length === 0) return [];

  let priceMin = Infinity;
  let priceMax = -Infinity;
  for (const c of visible) {
    if (c.low < priceMin) priceMin = c.low;
    if (c.high > priceMax) priceMax = c.high;
  }
  if (!Number.isFinite(priceMin) || !Number.isFinite(priceMax) || priceMin === priceMax) return [];

  const bucketHeight = (priceMax - priceMin) / bucketCount;
  const buckets: VolumeProfileBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    priceLow: priceMin + i * bucketHeight,
    priceHigh: priceMin + (i + 1) * bucketHeight,
    volume: 0,
  }));

  for (const c of visible) {
    const lowIdx = Math.max(0, Math.min(bucketCount - 1, Math.floor((c.low - priceMin) / bucketHeight)));
    const highIdx = Math.max(0, Math.min(bucketCount - 1, Math.floor((c.high - priceMin) / bucketHeight)));
    const span = highIdx - lowIdx + 1;
    const volumePerBucket = c.volume / span;
    for (let b = lowIdx; b <= highIdx; b++) buckets[b].volume += volumePerBucket;
  }

  return buckets;
}

export function pointOfControlIndex(buckets: VolumeProfileBucket[]): number {
  let maxIdx = 0;
  let maxVolume = -Infinity;
  buckets.forEach((b, i) => {
    if (b.volume > maxVolume) {
      maxVolume = b.volume;
      maxIdx = i;
    }
  });
  return maxIdx;
}

export interface DrawVolumeProfileArgs {
  ctx: CanvasRenderingContext2D;
  buckets: VolumeProfileBucket[];
  width: number;
  padding: { top: number; right: number; bottom: number; left: number };
  yDomain: [number, number];
  priceAreaHeight: number;
  maxWidthPx?: number;
  color?: string;
  pocColor?: string;
}

/** Right-aligned horizontal bars inside the existing price plot area, POC (Point of Control) highlighted. */
export function drawVolumeProfile({
  ctx,
  buckets,
  width,
  padding,
  yDomain,
  priceAreaHeight,
  maxWidthPx = 70,
  color = "rgba(62, 111, 224, 0.35)",
  pocColor = "#3b82f6",
}: DrawVolumeProfileArgs): void {
  if (buckets.length === 0) return;
  const [yMin, yMax] = yDomain;
  const ySpan = yMax - yMin || 1;
  const maxVolume = Math.max(...buckets.map((b) => b.volume), 1);
  const pocIdx = pointOfControlIndex(buckets);
  const rightEdge = width - padding.right;

  const yScale = (price: number) => padding.top + priceAreaHeight * (1 - (price - yMin) / ySpan);

  ctx.save();
  buckets.forEach((bucket, i) => {
    const yTop = yScale(bucket.priceHigh);
    const yBottom = yScale(bucket.priceLow);
    const barHeight = Math.max(1, yBottom - yTop);
    const barWidth = (bucket.volume / maxVolume) * maxWidthPx;
    ctx.fillStyle = i === pocIdx ? pocColor : color;
    ctx.fillRect(rightEdge - barWidth, yTop, barWidth, barHeight);
  });

  const pocBucket = buckets[pocIdx];
  const pocY = yScale((pocBucket.priceLow + pocBucket.priceHigh) / 2);
  ctx.strokeStyle = pocColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(padding.left, pocY);
  ctx.lineTo(rightEdge, pocY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
