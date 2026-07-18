export function computeMFI(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 14
): (number | null)[] {
  const len = closes.length;
  const out: (number | null)[] = new Array(len).fill(null);

  if (len <= period) return out;

  for (let i = period; i < len; i++) {
    let posMF = 0;
    let negMF = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const tp = (highs[j] + lows[j] + closes[j]) / 3;
      const prevTP = (highs[j - 1] + lows[j - 1] + closes[j - 1]) / 3;
      const mf = tp * volumes[j];

      if (tp > prevTP) posMF += mf;
      else negMF += mf;
    }

    const mfr = negMF === 0 ? 100 : posMF / negMF;
    out[i] = 100 - 100 / (1 + mfr);
  }

  return out;
}
