export function computeStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod: number = 14,
  dPeriod: number = 3
): { k: (number | null)[]; d: (number | null)[] } {
  const len = closes.length;
  const k: (number | null)[] = new Array(len).fill(null);
  const d: (number | null)[] = new Array(len).fill(null);

  const rawK: number[] = [];

  for (let i = kPeriod - 1; i < len; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j] > highestHigh) highestHigh = highs[j];
      if (lows[j] < lowestLow) lowestLow = lows[j];
    }
    const range = highestHigh - lowestLow;
    const value = range === 0 ? 50 : ((closes[i] - lowestLow) / range) * 100;
    k[i] = value;
    rawK.push(value);
  }

  for (let i = dPeriod - 1; i < rawK.length; i++) {
    let sum = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      sum += rawK[j];
    }
    d[kPeriod - 1 + i - (dPeriod - 1)] = sum / dPeriod;
  }

  return { k, d };
}
