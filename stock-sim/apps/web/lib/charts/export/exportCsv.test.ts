import { describe, expect, it } from "vitest";
import { buildComparisonCsv } from "./exportCsv";

describe("buildComparisonCsv", () => {
  it("returns an empty string for no series", () => {
    expect(buildComparisonCsv([])).toBe("");
  });

  it("builds a header row plus one row per date", () => {
    const csv = buildComparisonCsv([
      { label: "Live Market", dates: ["2026-01-01", "2026-01-02"], values: [100, 101] },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("sim_date,Live Market");
    expect(lines[1]).toBe("2026-01-01,100");
    expect(lines[2]).toBe("2026-01-02,101");
  });

  it("puts multiple series in separate columns aligned by row index", () => {
    const csv = buildComparisonCsv([
      { label: "Live", dates: ["2026-01-01", "2026-01-02"], values: [100, 101] },
      { label: "Branch A", dates: ["2026-01-01", "2026-01-02"], values: [100, 95] },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("sim_date,Live,Branch A");
    expect(lines[1]).toBe("2026-01-01,100,100");
    expect(lines[2]).toBe("2026-01-02,101,95");
  });

  it("pads shorter series with empty cells instead of truncating the longer one", () => {
    const csv = buildComparisonCsv([
      { label: "Long", dates: ["2026-01-01", "2026-01-02", "2026-01-03"], values: [100, 101, 102] },
      { label: "Short", dates: ["2026-01-01"], values: [100] },
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(4); // header + 3 data rows
    expect(lines[1]).toBe("2026-01-01,100,100");
    expect(lines[2]).toBe("2026-01-02,101,");
    expect(lines[3]).toBe("2026-01-03,102,");
  });

  it("escapes cells containing commas, quotes, or newlines", () => {
    const csv = buildComparisonCsv([
      { label: 'Branch, "Weird" Name', dates: ["2026-01-01"], values: [100] },
    ]);
    const header = csv.split("\n")[0];
    expect(header).toBe('sim_date,"Branch, ""Weird"" Name"');
  });
});
