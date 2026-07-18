export function computeCCI(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 20
): (number | null)[] {
  const len = closes.length;
  const out: (number | null)[] = new Array(len).fill(null);

  for (let i = period - 1; i < len; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += (highs[j] + lows[j] + closes[j]) / 3;
    }
    const mean = sum / period;

    let meanDev = 0;
    for (let j = i - period + 1; j <= i; j++) {
      meanDev += Math.abs(((highs[j] + lows[j] + closes[j]) / 3) - mean);
    }
    meanDev /= period;

    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    out[i] = meanDev === 0 ? 0 : (tp - mean) / (0.015 * meanDev);
  }

  return out;
}
