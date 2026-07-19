import type { LinePoint } from "@/lib/charts/types";

export const FAN_CHART_PERCENTILES = [10, 25, 50, 75, 90] as const;
export type FanChartPercentile = (typeof FAN_CHART_PERCENTILES)[number];

/** Per-time-step percentile paths across N member series (e.g. Monte Carlo
 * ensemble price paths), for the fan chart's shaded bands + median line.
 * A time step with no values from any series yields 0 for every percentile
 * at that step (rather than throwing), so a ragged-length ensemble doesn't
 * break the chart -- callers should generally clip to the shortest member's
 * length before charting to avoid a visible drop to zero at the tail. */
export function computePercentilePaths(
  series: LinePoint[][],
  length: number
): Record<FanChartPercentile, number[]> {
  const result: Record<number, number[]> = {};
  for (const p of FAN_CHART_PERCENTILES) result[p] = [];

  for (let t = 0; t < length; t++) {
    const valuesAtT = series.map((s) => s[t]?.value).filter((v): v is number => v !== undefined);
    if (valuesAtT.length === 0) {
      for (const p of FAN_CHART_PERCENTILES) result[p].push(0);
      continue;
    }
    const sorted = [...valuesAtT].sort((a, b) => a - b);
    for (const p of FAN_CHART_PERCENTILES) {
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
      result[p].push(sorted[idx]);
    }
  }
  return result as Record<FanChartPercentile, number[]>;
}
