import { describe, expect, it } from "vitest";
import { emptyScreenerQuery, marketFiltersToQuery, screenerQueryToCommandText } from "./screenerQuery";

describe("screener query contract", () => {
  it("compiles legacy filters and sort into the shared query shape", () => {
    const query = marketFiltersToQuery(
      {
        industries: ["Technology"],
        price: { min: 10, max: 100 },
        marketCap: null,
        dayChangePct: null,
        volatility: null,
        ivGapPct: { min: -20, max: 20 },
        iv: null,
        volume: null,
        marketCapCategory: ["Large"],
      },
      { key: "marketCap", direction: "desc" },
      ["marketCap", "ivGap"],
      { timelineId: 7, asOfDate: "2026-08-10" },
    );

    expect(query.version).toBe(1);
    expect(query.timeline_id).toBe(7);
    expect(query.as_of_date).toBe("2026-08-10");
    expect(query.clauses).toEqual(expect.arrayContaining([
      { metric: "industry_name", operator: "in", value: ["Technology"] },
      { metric: "market_cap_category", operator: "in", value: ["Large"] },
      { metric: "price", operator: ">=", value: 10 },
      { metric: "iv_gap_pct", operator: "<=", value: 20 },
    ]));
    expect(query.sort).toEqual([{ metric: "market_cap", direction: "desc" }]);
  });

  it("round-trips supported clauses back to the terminal command line", () => {
    const command = screenerQueryToCommandText({
      ...emptyScreenerQuery(),
      clauses: [
        { metric: "market_cap_category", operator: "in", value: ["Large", "Mega"] },
        { metric: "day_change_pct", operator: ">", value: 5 },
        { metric: "day_change_pct", operator: "<", value: 20 },
      ],
    });
    expect(command).toContain("cap:large,mega");
    expect(command).toContain("chg>5");
    expect(command).toContain("chg<20");
  });
});
