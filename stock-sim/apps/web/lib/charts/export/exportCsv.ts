export interface ComparisonSeriesForExport {
  label: string;
  dates: string[];
  values: number[];
}

/** Section 11.5 — builds a CSV string for a timeline comparison: one row per
 * date, one column per timeline series. Series with differing lengths (a
 * branch that has ticked further/less than another) are padded with empty
 * cells rather than truncated, so no data is silently dropped from the
 * export. Pure/no side effects, so it's independently testable from the
 * actual browser download trigger (exportComparisonCsv below). */
export function buildComparisonCsv(series: ComparisonSeriesForExport[]): string {
  if (series.length === 0) return "";

  const maxLen = Math.max(...series.map((s) => s.values.length));
  const header = ["sim_date", ...series.map((s) => s.label)];
  const rows: string[][] = [header];

  for (let i = 0; i < maxLen; i++) {
    const dateCell = series.find((s) => s.dates[i])?.dates[i] ?? "";
    const row = [dateCell, ...series.map((s) => (s.values[i] !== undefined ? String(s.values[i]) : ""))];
    rows.push(row);
  }

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function exportComparisonCsv(series: ComparisonSeriesForExport[], filename = "timeline-comparison.csv"): void {
  const csv = buildComparisonCsv(series);
  if (!csv) return;
  downloadTextFile(csv, filename, "text/csv;charset=utf-8");
}

function escapeCsvCell(cell: string): string {
  if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
