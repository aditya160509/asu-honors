export function computeOBV(closes: number[], volumes: number[]): (number | null)[] {
  const len = closes.length;
  const out: (number | null)[] = new Array(len).fill(null);
  if (len === 0) return out;

  out[0] = volumes[0];

  for (let i = 1; i < len; i++) {
    if (closes[i] > closes[i - 1]) {
      out[i] = out[i - 1]! + volumes[i];
    } else if (closes[i] < closes[i - 1]) {
      out[i] = out[i - 1]! - volumes[i];
    } else {
      out[i] = out[i - 1];
    }
  }

  return out;
}
