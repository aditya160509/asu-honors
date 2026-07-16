/** Exponential moving average. Seeded with the SMA of the first `period` closes; null before that point. */
export function computeEMA(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period) return out;

  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += closes[i];
  seed /= period;
  out[period - 1] = seed;

  let prev = seed;
  for (let i = period; i < closes.length; i++) {
    prev = closes[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}
