export function computeATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): (number | null)[] {
  const len = closes.length;
  const out: (number | null)[] = new Array(len).fill(null);

  if (len < 2) return out;

  const tr: number[] = new Array(len).fill(0);
  tr[0] = highs[0] - lows[0];

  for (let i = 1; i < len; i++) {
    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }

  let sum = 0;
  for (let i = 0; i < period && i < len; i++) sum += tr[i];

  if (len >= period) {
    out[period - 1] = sum / period;

    for (let i = period; i < len; i++) {
      out[i] = (out[i - 1]! * (period - 1) + tr[i]) / period;
    }
  }

  return out;
}
