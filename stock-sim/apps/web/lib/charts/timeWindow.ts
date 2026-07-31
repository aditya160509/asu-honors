import type { CustomDateRange } from "@/lib/stores/timeControlStore";

export const TIME_WINDOWS = [
  { label: "1D", observations: 1 },
  { label: "5D", observations: 5 },
  { label: "1W", observations: 7 },
  { label: "1M", observations: 30 },
  { label: "3M", observations: 90 },
  { label: "6M", observations: 180 },
  { label: "YTD", observations: -1 },
  { label: "1Y", observations: 365 },
  { label: "ALL", observations: null },
] as const;

export function selectTimeWindow<T extends { sim_date: string }>(
  rows: readonly T[],
  timeRange: string,
  customRange: CustomDateRange | null,
): T[] {
  if (rows.length === 0) return [];
  if (customRange) {
    return rows.filter((row) => row.sim_date >= customRange.start && row.sim_date <= customRange.end);
  }
  const window = TIME_WINDOWS.find((candidate) => candidate.label === timeRange);
  if (!window || window.observations === null) return [...rows];
  if (window.observations === -1) {
    const lastYear = rows[rows.length - 1].sim_date.slice(0, 4);
    return rows.filter((row) => row.sim_date.startsWith(lastYear));
  }
  return rows.slice(-window.observations);
}
