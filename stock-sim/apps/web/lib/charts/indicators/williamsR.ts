export function computeWilliamsR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): (number | null)[] {
  const len = closes.length;
  const out: (number | null)[] = new Array(len).fill(null);

  for (let i = period - 1; i < len; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > highestHigh) highestHigh = highs[j];
      if (lows[j] < lowestLow) lowestLow = lows[j];
    }
    const range = highestHigh - lowestLow;
    out[i] = range === 0 ? -50 : ((highestHigh - closes[i]) / range) * -100;
  }

  return out;
}
