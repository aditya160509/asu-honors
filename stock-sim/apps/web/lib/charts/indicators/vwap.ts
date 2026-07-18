export function computeVWAP(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[]
): (number | null)[] {
  const len = closes.length;
  const out: (number | null)[] = new Array(len).fill(null);

  let cumTPV = 0;
  let cumVol = 0;

  for (let i = 0; i < len; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTPV += tp * volumes[i];
    cumVol += volumes[i];
    out[i] = cumVol === 0 ? tp : cumTPV / cumVol;
  }

  return out;
}
