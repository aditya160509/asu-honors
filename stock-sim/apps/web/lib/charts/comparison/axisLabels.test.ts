import { describe, expect, it } from "vitest";
import { relativeDayAxisLabels } from "./axisLabels";

describe("relativeDayAxisLabels", () => {
  it("labels every step as a day offset from the comparison's own start, not a calendar date", () => {
    const labels = relativeDayAxisLabels(5, 1);
    expect(labels.map((l) => l.text)).toEqual(["Day 0", "Day 1", "Day 2", "Day 3", "Day 4"]);
  });

  it("only emits one label per step interval", () => {
    const labels = relativeDayAxisLabels(10, 3);
    expect(labels.map((l) => l.x)).toEqual([0, 3, 6, 9]);
    expect(labels.map((l) => l.text)).toEqual(["Day 0", "Day 3", "Day 6", "Day 9"]);
  });

  it("returns an empty array for zero-length series", () => {
    expect(relativeDayAxisLabels(0, 1)).toEqual([]);
  });

  it("clamps a step interval below 1 to 1 so it never divides by zero or loops forever", () => {
    const labels = relativeDayAxisLabels(4, 0);
    expect(labels.map((l) => l.x)).toEqual([0, 1, 2, 3]);
  });
});
