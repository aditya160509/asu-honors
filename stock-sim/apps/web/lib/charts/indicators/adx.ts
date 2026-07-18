function computeDI(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): { plusDI: number[]; minusDI: number[] } {
  const len = highs.length;
  const plusDI: number[] = new Array(len).fill(0);
  const minusDI: number[] = new Array(len).fill(0);

  for (let i = period; i < len; i++) {
    let trSum = 0;
    let plusDMSum = 0;
    let minusDMSum = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const upMove = highs[j] - highs[j - 1];
      const downMove = lows[j - 1] - lows[j];
      const tr = Math.max(
        highs[j] - lows[j],
        Math.abs(highs[j] - closes[j - 1]),
        Math.abs(lows[j] - closes[j - 1])
      );
      trSum += tr;
      plusDMSum += upMove > downMove && upMove > 0 ? upMove : 0;
      minusDMSum += downMove > upMove && downMove > 0 ? downMove : 0;
    }

    if (trSum > 0) {
      plusDI[i] = (plusDMSum / trSum) * 100;
      minusDI[i] = (minusDMSum / trSum) * 100;
    }
  }

  return { plusDI, minusDI };
}

export function computeADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): { adx: (number | null)[]; plusDI: (number | null)[]; minusDI: (number | null)[] } {
  const len = closes.length;
  const adx: (number | null)[] = new Array(len).fill(null);
  const plusDIOut: (number | null)[] = new Array(len).fill(null);
  const minusDIOut: (number | null)[] = new Array(len).fill(null);

  const { plusDI, minusDI } = computeDI(highs, lows, closes, period);

  for (let i = 0; i < len; i++) {
    if (plusDI[i] !== 0 || minusDI[i] !== 0) {
      plusDIOut[i] = plusDI[i];
      minusDIOut[i] = minusDI[i];
    }
  }

  const dxValues: number[] = [];
  for (let i = period; i < len; i++) {
    const sum = plusDI[i] + minusDI[i];
    const dx = sum === 0 ? 0 : (Math.abs(plusDI[i] - minusDI[i]) / sum) * 100;
    dxValues.push(dx);
  }

  if (dxValues.length >= period) {
    let adxSum = 0;
    for (let i = 0; i < period; i++) adxSum += dxValues[i];
    let adxVal = adxSum / period;
    adx[period * 2 - 1] = adxVal;

    for (let i = period; i < dxValues.length; i++) {
      adxVal = (adxVal * (period - 1) + dxValues[i]) / period;
      adx[period + i] = adxVal;
    }
  }

  return { adx, plusDI: plusDIOut, minusDI: minusDIOut };
}
