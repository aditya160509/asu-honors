import { describe, expect, it } from "vitest";
import { buildBranchOutcomeSummary } from "./outcomeSummary";

describe("buildBranchOutcomeSummary", () => {
  it("describes a manual branch with no overrides and no fast-forward", () => {
    const summary = buildBranchOutcomeSummary({
      primitive: "manual",
      overrideCount: 0,
      branchPointSimDate: "2026-06-25",
      fastForwardDays: 0,
      tickCount: 0,
      marketComparison: null,
    });
    expect(summary).toContain("forked from the live market on 2026-06-25");
    expect(summary).toContain("no overrides");
    expect(summary).toContain("stays frozen at its branch point");
  });

  it("describes a structural override branch with overrides and completed ticks", () => {
    const summary = buildBranchOutcomeSummary({
      primitive: "structural_override",
      overrideCount: 2,
      branchPointSimDate: "2026-06-25",
      fastForwardDays: 200,
      tickCount: 200,
      marketComparison: null,
    });
    expect(summary).toContain("structural override");
    expect(summary).toContain("2 override(s)");
    expect(summary).toContain("200 sim-day(s)");
  });

  it("reports fewer ticks applied than requested when the run stopped early", () => {
    const summary = buildBranchOutcomeSummary({
      primitive: "macro_shock",
      overrideCount: 1,
      branchPointSimDate: "2026-06-25",
      fastForwardDays: 200,
      tickCount: 50,
      marketComparison: null,
    });
    expect(summary).toContain("50 of the requested 200 sim-day(s)");
  });

  it("includes a market-wide price comparison against the parent when provided", () => {
    const summary = buildBranchOutcomeSummary({
      primitive: "macro_shock",
      overrideCount: 1,
      branchPointSimDate: "2026-06-25",
      fastForwardDays: 200,
      tickCount: 200,
      marketComparison: { companyCount: 10, avgPctDiff: 4.2, higherCount: 2, lowerCount: 7 },
    });
    expect(summary).toContain("7 of 10 companies");
    expect(summary).toContain("4.2%");
    expect(summary).toContain("lower");
  });

  it("says prices matched the live market when the average difference rounds to zero", () => {
    const summary = buildBranchOutcomeSummary({
      primitive: "manual",
      overrideCount: 0,
      branchPointSimDate: "2026-06-25",
      fastForwardDays: 10,
      tickCount: 10,
      marketComparison: { companyCount: 10, avgPctDiff: 0, higherCount: 0, lowerCount: 0 },
    });
    expect(summary).toContain("tracked the live market's prices closely");
  });
});
