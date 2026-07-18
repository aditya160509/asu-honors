function highest(data: number[], start: number, period: number): number {
  let max = -Infinity;
  for (let i = start; i < start + period && i < data.length; i++) {
    if (data[i] > max) max = data[i];
  }
  return max;
}

function lowest(data: number[], start: number, period: number): number {
  let min = Infinity;
  for (let i = start; i < start + period && i < data.length; i++) {
    if (data[i] < min) min = data[i];
  }
  return min;
}

export function computeIchimoku(
  highs: number[],
  lows: number[],
  closes: number[]
): {
  tenkan: (number | null)[];
  kijun: (number | null)[];
  senkouA: (number | null)[];
  senkouB: (number | null)[];
  chikou: (number | null)[];
} {
  const len = closes.length;
  const tenkanPeriod = 9;
  const kijunPeriod = 26;
  const senkouBPeriod = 52;

  const tenkan: (number | null)[] = new Array(len).fill(null);
  const kijun: (number | null)[] = new Array(len).fill(null);
  const senkouA: (number | null)[] = new Array(len).fill(null);
  const senkouB: (number | null)[] = new Array(len).fill(null);
  const chikou: (number | null)[] = new Array(len).fill(null);

  for (let i = tenkanPeriod - 1; i < len; i++) {
    tenkan[i] = (highest(highs, i - tenkanPeriod + 1, tenkanPeriod) + lowest(lows, i - tenkanPeriod + 1, tenkanPeriod)) / 2;
  }

  for (let i = kijunPeriod - 1; i < len; i++) {
    kijun[i] = (highest(highs, i - kijunPeriod + 1, kijunPeriod) + lowest(lows, i - kijunPeriod + 1, kijunPeriod)) / 2;
  }

  for (let i = 0; i < len; i++) {
    if (tenkan[i] != null && kijun[i] != null) {
      const aIdx = i + kijunPeriod;
      if (aIdx < len) {
        senkouA[aIdx] = (tenkan[i]! + kijun[i]!) / 2;
      }
    }
  }

  for (let i = senkouBPeriod - 1; i < len; i++) {
    const bIdx = i + kijunPeriod;
    if (bIdx < len) {
      senkouB[bIdx] = (highest(highs, i - senkouBPeriod + 1, senkouBPeriod) + lowest(lows, i - senkouBPeriod + 1, senkouBPeriod)) / 2;
    }
  }

  for (let i = kijunPeriod; i < len; i++) {
    chikou[i - kijunPeriod] = closes[i];
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}
