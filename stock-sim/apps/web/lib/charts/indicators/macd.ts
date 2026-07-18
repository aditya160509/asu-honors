import { computeEMA } from "./ema";

export function computeMACD(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const len = closes.length;
  const macdLine = computeEMA(closes, fast);
  const slowEMA = computeEMA(closes, slow);

  const macd: (number | null)[] = new Array(len).fill(null);
  const signalLine: (number | null)[] = new Array(len).fill(null);
  const histogram: (number | null)[] = new Array(len).fill(null);

  for (let i = 0; i < len; i++) {
    if (macdLine[i] != null && slowEMA[i] != null) {
      macd[i] = macdLine[i]! - slowEMA[i]!;
    }
  }

  const macdValues: number[] = [];
  for (let i = 0; i < len; i++) {
    if (macd[i] != null) macdValues.push(macd[i]!);
  }

  if (macdValues.length >= signal) {
    const signalEMA = computeEMA(macdValues, signal);
    let offset = 0;
    for (let i = 0; i < len; i++) {
      if (macd[i] != null) {
        if (signalEMA[offset] != null) {
          signalLine[i] = signalEMA[offset];
        }
        offset++;
      }
    }
  }

  for (let i = 0; i < len; i++) {
    if (macd[i] != null && signalLine[i] != null) {
      histogram[i] = macd[i]! - signalLine[i]!;
    }
  }

  return { macd, signal: signalLine, histogram };
}
