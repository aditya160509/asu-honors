import { describe, expect, it } from "vitest";
import { findDivergenceIndex } from "./divergence";

function series(values: number[]) {
  return { points: values.map((value, time) => ({ time, value })) };
}

describe("findDivergenceIndex", () => {
  it("returns null when fewer than 2 series are given", () => {
    expect(findDivergenceIndex([series([100, 101, 102])], 3)).toBeNull();
    expect(findDivergenceIndex([], 3)).toBeNull();
  });

  it("returns null when series never diverge beyond the threshold", () => {
    const a = series([100, 101, 102, 103]);
    const b = series([100, 101.5, 102, 103.5]);
    expect(findDivergenceIndex([a, b], 3)).toBeNull();
  });

  it("finds the first index where the divergence exceeds the threshold", () => {
    const baseline = series([100, 100, 100, 100, 100]);
    const shocked = series([100, 100, 100, 110, 120]); // +10% at index 3
    expect(findDivergenceIndex([baseline, shocked], 5)).toBe(3);
  });

  it("compares every non-baseline series against the first (baseline) series", () => {
    const baseline = series([100, 100, 100]);
    const close = series([100, 101, 102]);
    const far = series([100, 100, 130]); // +30% at index 2
    expect(findDivergenceIndex([baseline, close, far], 5)).toBe(2);
  });

  it("only compares over the overlapping (shorter) length", () => {
    const short = series([100, 100]);
    const long = series([100, 100, 100, 200]); // divergence only past short's length
    expect(findDivergenceIndex([short, long], 5)).toBeNull();
  });

  it("skips a baseline value of zero to avoid a division-by-zero false positive", () => {
    const baseline = series([0, 100]);
    const other = series([5, 105]);
    // index 0 has base=0 (skipped); index 1 has a real ~5% divergence
    expect(findDivergenceIndex([baseline, other], 3)).toBe(1);
  });
});
