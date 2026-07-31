import { describe, expect, it } from "vitest";
import { selectTimeWindow } from "./timeWindow";

const rows = Array.from({ length: 12 }, (_, index) => ({
  sim_date: `2026-01-${String(index + 1).padStart(2, "0")}`,
  value: index,
}));

describe("selectTimeWindow", () => {
  it.each([["1D", 1], ["5D", 5], ["1W", 7]])("returns exactly %s observations", (range, count) => {
    expect(selectTimeWindow(rows, range, null)).toHaveLength(count as number);
  });

  it("uses the latest observations", () => {
    expect(selectTimeWindow(rows, "5D", null).map((row) => row.value)).toEqual([7, 8, 9, 10, 11]);
  });

  it("honors inclusive custom dates", () => {
    expect(selectTimeWindow(rows, "ALL", { start: "2026-01-03", end: "2026-01-05" })).toHaveLength(3);
  });
});
