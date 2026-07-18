export function computeCMF(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 20
): (number | null)[] {
  const len = closes.length;
  const out: (number | null)[] = new Array(len).fill(null);

  for (let i = period - 1; i < len; i++) {
    let mfVolume = 0;
    let volSum = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const hlRange = highs[j] - lows[j];
      const mfm = hlRange === 0 ? 0 : ((closes[j] - lows[j]) - (highs[j] - closes[j])) / hlRange;
      mfVolume += mfm * volumes[j];
      volSum += volumes[j];
    }

    out[i] = volSum === 0 ? 0 : mfVolume / volSum;
  }

  return out;
}
