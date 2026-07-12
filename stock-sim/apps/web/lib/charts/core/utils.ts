/** Snaps a coordinate so 1px (and odd-width) lines render crisp, not blurry, at any DPR. */
export function alignToDevicePixel(value: number, lineWidth: number, dpr: number): number {
  const scaled = value * dpr;
  const isOdd = Math.round(lineWidth * dpr) % 2 === 1;
  return (isOdd ? Math.floor(scaled) + 0.5 : Math.round(scaled)) / dpr;
}

export function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

export function niceDomain(min: number, max: number, padPct = 0.05): [number, number] {
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * padPct;
  return [min - pad, max + pad];
}

export function formatPriceAxis(value: number): string {
  return value.toFixed(2);
}

export function formatDateAxis(time: number): string {
  return new Date(time).toISOString().slice(5, 10);
}

/** Binary search for the index range of timestamps within [from, to]. */
export function clampToVisibleRange<T extends { time: number }>(
  data: T[],
  from: number,
  to: number
): T[] {
  if (data.length === 0) return data;
  let lo = 0;
  let hi = data.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (data[mid].time < from) lo = mid + 1;
    else hi = mid;
  }
  const start = lo;
  lo = 0;
  hi = data.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (data[mid].time <= to) lo = mid + 1;
    else hi = mid;
  }
  return data.slice(start, lo);
}
