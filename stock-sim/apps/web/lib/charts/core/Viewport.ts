import type { VisibleRange } from "@/lib/charts/types";

export const MIN_VISIBLE_CANDLES = 10;

export function zoomRange(range: VisibleRange, dataLen: number, factor: number, centerFrac: number): VisibleRange {
  const span = range.to - range.from;
  const center = range.from + span * centerFrac;
  const newSpan = Math.max(MIN_VISIBLE_CANDLES, Math.min(dataLen, span * factor));
  let from = center - newSpan * centerFrac;
  let to = from + newSpan;
  if (from < 0) {
    to -= from;
    from = 0;
  }
  if (to > dataLen) {
    from -= to - dataLen;
    to = dataLen;
  }
  return { from: Math.max(0, Math.round(from)), to: Math.round(to) };
}

export function panRange(range: VisibleRange, dataLen: number, deltaCandles: number): VisibleRange {
  const span = range.to - range.from;
  let from = range.from + deltaCandles;
  let to = range.to + deltaCandles;
  if (from < 0) {
    from = 0;
    to = span;
  }
  if (to > dataLen) {
    to = dataLen;
    from = dataLen - span;
  }
  return { from, to };
}

export function defaultRange(dataLen: number, maxVisible = 200): VisibleRange {
  return { from: Math.max(0, dataLen - maxVisible), to: dataLen };
}
