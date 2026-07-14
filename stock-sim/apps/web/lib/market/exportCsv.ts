import type { ColumnDef, EnrichedCompany } from "@/lib/market/types";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Client-side CSV export of the currently filtered/sorted/visible-column result set. */
export function exportCompaniesCsv(rows: EnrichedCompany[], columns: ColumnDef[], filename = "market-screen.csv") {
  const headers = ["Ticker", "Name", ...columns.map((c) => c.header)];
  const lines = [headers.map(csvEscape).join(",")];

  for (const row of rows) {
    const cells = [
      row.ticker,
      row.name,
      ...columns.map((c) => {
        const v = c.sortAccessor(row);
        return v == null ? "" : String(v);
      }),
    ];
    lines.push(cells.map((v) => csvEscape(String(v))).join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
