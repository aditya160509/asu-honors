export function computeRSI(closes: number[], period: number = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }

  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) {
    out[period] = 100;
  } else {
    out[period] = 100 - 100 / (1 + avgGain / avgLoss);
  }

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    if (avgLoss === 0) {
      out[i] = 100;
    } else {
      out[i] = 100 - 100 / (1 + avgGain / avgLoss);
    }
  }

  return out;
}
