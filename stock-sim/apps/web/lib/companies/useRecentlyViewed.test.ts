import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { __resetForTests, logCompanyView, useRecentlyViewed } from "./useRecentlyViewed";

describe("useRecentlyViewed", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetForTests();
  });

  it("adds a viewed company to the front of the list", () => {
    logCompanyView("AAPL", "Apple Inc.");
    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current[0]).toMatchObject({ ticker: "AAPL", name: "Apple Inc." });
  });

  it("moves a re-viewed company back to the front instead of duplicating it", () => {
    logCompanyView("AAPL", "Apple Inc.");
    logCompanyView("MSFT", "Microsoft Corp.");
    logCompanyView("AAPL", "Apple Inc.");

    const { result } = renderHook(() => useRecentlyViewed());
    const tickers = result.current.map((e) => e.ticker);
    expect(tickers.filter((t) => t === "AAPL")).toHaveLength(1);
    expect(tickers[0]).toBe("AAPL");
    expect(tickers[1]).toBe("MSFT");
  });

  it("caps the list at 8 entries", () => {
    for (let i = 0; i < 12; i++) {
      logCompanyView(`T${i}`, `Company ${i}`);
    }
    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current).toHaveLength(8);
    // Most recent (T11) first, oldest surviving entries trimmed off the end.
    expect(result.current[0].ticker).toBe("T11");
  });
});
