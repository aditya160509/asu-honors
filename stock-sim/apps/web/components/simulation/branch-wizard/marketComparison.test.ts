import { describe, expect, it } from "vitest";
import { compareMarketGrids } from "./marketComparison";
import type { CompanyGridItem } from "@/lib/api/types";

function company(overrides: Partial<CompanyGridItem> = {}): CompanyGridItem {
  return {
    id: 1,
    ticker: "AAP",
    name: "Apex Auto Parts",
    industry_name: "Industrials",
    current_price: 100,
    prev_close: 100,
    day_change_pct: 0,
    intrinsic_value: 100,
    market_cap: 1_000_000,
    volatility: 0.2,
    market_liquidity_score: 0.5,
    avg_volume_20d: 1000,
    high_52w: 120,
    low_52w: 80,
    ...overrides,
  };
}

describe("compareMarketGrids", () => {
  it("returns null when either grid has no companies", () => {
    expect(compareMarketGrids([], [company()])).toBeNull();
    expect(compareMarketGrids([company()], [])).toBeNull();
  });

  it("computes zero average difference when prices are identical", () => {
    const grid = [company({ id: 1, current_price: 100 }), company({ id: 2, current_price: 50 })];
    const result = compareMarketGrids(grid, grid);
    expect(result).toEqual({ companyCount: 2, avgPctDiff: 0, higherCount: 0, lowerCount: 0 });
  });

  it("counts companies priced higher vs. lower on the branch and averages the absolute difference", () => {
    const parent = [company({ id: 1, current_price: 100 }), company({ id: 2, current_price: 200 })];
    const branch = [company({ id: 1, current_price: 110 }), company({ id: 2, current_price: 180 })];
    // id 1: +10% (higher), id 2: -10% (lower) -> avg abs diff 10%
    const result = compareMarketGrids(parent, branch);
    expect(result).toEqual({ companyCount: 2, avgPctDiff: 10, higherCount: 1, lowerCount: 1 });
  });

  it("only compares companies present in both grids by id", () => {
    const parent = [company({ id: 1, current_price: 100 }), company({ id: 2, current_price: 100 })];
    const branch = [company({ id: 1, current_price: 100 })];
    const result = compareMarketGrids(parent, branch);
    expect(result?.companyCount).toBe(1);
  });
});
