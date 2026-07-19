import { describe, expect, it } from "vitest";
import { computePercentilePaths, FAN_CHART_PERCENTILES } from "./percentiles";
import type { LinePoint } from "@/lib/charts/types";

function toSeries(values: number[]): LinePoint[] {
  return values.map((value, time) => ({ time, value }));
}

describe("computePercentilePaths", () => {
  it("computes all 5 standard percentiles for every time step", () => {
    const series = [toSeries([10, 20]), toSeries([20, 30]), toSeries([30, 40])];
    const result = computePercentilePaths(series, 2);

    for (const p of FAN_CHART_PERCENTILES) {
      expect(result[p]).toHaveLength(2);
    }
    // median of [10, 20, 30] at t=0
    expect(result[50][0]).toBe(20);
    // median of [20, 30, 40] at t=1
    expect(result[50][1]).toBe(30);
  });

  it("the 10th percentile is always <= the 90th percentile at every step", () => {
    const series = [toSeries([5, 50]), toSeries([15, 10]), toSeries([25, 80]), toSeries([2, 5])];
    const result = computePercentilePaths(series, 2);
    for (let t = 0; t < 2; t++) {
      expect(result[10][t]).toBeLessThanOrEqual(result[90][t]);
    }
  });

  it("fills 0 for a time step where no member series has data", () => {
    const series = [toSeries([100]), toSeries([100])]; // both length 1
    const result = computePercentilePaths(series, 3); // asked for length 3
    for (const p of FAN_CHART_PERCENTILES) {
      expect(result[p][0]).toBe(100);
      expect(result[p][1]).toBe(0);
      expect(result[p][2]).toBe(0);
    }
  });

  it("handles a single member series (all percentiles equal that series' value)", () => {
    const series = [toSeries([42, 43])];
    const result = computePercentilePaths(series, 2);
    for (const p of FAN_CHART_PERCENTILES) {
      expect(result[p][0]).toBe(42);
      expect(result[p][1]).toBe(43);
    }
  });

  it("returns empty arrays for length 0", () => {
    const result = computePercentilePaths([toSeries([1, 2, 3])], 0);
    for (const p of FAN_CHART_PERCENTILES) {
      expect(result[p]).toEqual([]);
    }
  });
});
