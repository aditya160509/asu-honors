export function computeROC(closes: number[], period: number = 12): (number | null)[] {
  const len = closes.length;
  const out: (number | null)[] = new Array(len).fill(null);

  for (let i = period; i < len; i++) {
    const prev = closes[i - period];
    out[i] = prev === 0 ? 0 : ((closes[i] - prev) / prev) * 100;
  }

  return out;
}
