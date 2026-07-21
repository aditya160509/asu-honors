/** Maps a pointer's x position (in plot-area-local px) to the nearest data
 * index, for tooltip lookups on an index-aligned comparison chart. Clamps to
 * [0, length-1] so a pointer past either edge still resolves to a real point
 * instead of an out-of-range index. */
export function nearestIndexForX(x: number, plotWidth: number, length: number): number {
  if (length <= 1) return 0;
  const frac = plotWidth === 0 ? 0 : x / plotWidth;
  const idx = Math.round(frac * (length - 1));
  return Math.min(length - 1, Math.max(0, idx));
}
