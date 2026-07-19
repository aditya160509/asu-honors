import type { LinePoint } from "@/lib/charts/types";

export interface DivergenceSeries {
  points: LinePoint[];
}

/** First index (in the shorter series' local index space) where two or more
 * series' values diverge by more than thresholdPct from the first
 * (baseline) series. Returns null if fewer than 2 series are given or no
 * divergence is found within the overlapping range. */
export function findDivergenceIndex(series: DivergenceSeries[], thresholdPct: number): number | null {
  if (series.length < 2) return null;
  const baseline = series[0].points;
  const minLen = Math.min(...series.map((s) => s.points.length));
  for (let i = 0; i < minLen; i++) {
    const base = baseline[i]?.value;
    if (base === undefined || base === 0) continue;
    for (let s = 1; s < series.length; s++) {
      const other = series[s].points[i]?.value;
      if (other === undefined) continue;
      const pctDiff = (Math.abs(other - base) / Math.abs(base)) * 100;
      if (pctDiff > thresholdPct) return i;
    }
  }
  return null;
}
