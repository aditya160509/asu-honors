import { computeATR } from "./atr";

export function computeSuperTrend(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 10,
  multiplier: number = 3
): { superTrend: (number | null)[]; direction: (number | 1 | -1 | null)[] } {
  const len = closes.length;
  const superTrend: (number | null)[] = new Array(len).fill(null);
  const direction: (number | 1 | -1 | null)[] = new Array(len).fill(null);

  const atr = computeATR(highs, lows, closes, period);

  const upperBand: number[] = new Array(len).fill(0);
  const lowerBand: number[] = new Array(len).fill(0);
  const finalUpperBand: number[] = new Array(len).fill(0);
  const finalLowerBand: number[] = new Array(len).fill(0);

  for (let i = 0; i < len; i++) {
    const hl2 = (highs[i] + lows[i]) / 2;
    if (atr[i] != null) {
      upperBand[i] = hl2 + multiplier * atr[i]!;
      lowerBand[i] = hl2 - multiplier * atr[i]!;
    }
  }

  finalUpperBand[0] = upperBand[0];
  finalLowerBand[0] = lowerBand[0];

  let prevSuperTrend = 0;
  let prevDirection = 1;

  for (let i = 1; i < len; i++) {
    if (lowerBand[i] > finalLowerBand[i - 1] || closes[i - 1] < finalLowerBand[i - 1]) {
      finalLowerBand[i] = lowerBand[i];
    } else {
      finalLowerBand[i] = finalLowerBand[i - 1];
    }

    if (upperBand[i] < finalUpperBand[i - 1] || closes[i - 1] > finalUpperBand[i - 1]) {
      finalUpperBand[i] = upperBand[i];
    } else {
      finalUpperBand[i] = finalUpperBand[i - 1];
    }

    if (atr[i] == null) continue;

    let dir = prevDirection;
    if (prevDirection === 1) {
      if (closes[i] < prevSuperTrend) {
        dir = -1;
      }
    } else {
      if (closes[i] > prevSuperTrend) {
        dir = 1;
      }
    }

    let st: number;
    if (dir === 1) {
      st = finalLowerBand[i];
    } else {
      st = finalUpperBand[i];
    }

    superTrend[i] = st;
    direction[i] = dir;
    prevSuperTrend = st;
    prevDirection = dir;
  }

  return { superTrend, direction };
}
