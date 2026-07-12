import * as React from "react";
import { cn } from "@/lib/utils";
import { formatDate, formatLarge, formatPct, formatPrice, formatTicker } from "@/lib/utils";
import type { GridColumnFormat } from "@/lib/grid/types";

export interface GridCellProps {
  value: unknown;
  format?: GridColumnFormat;
  align?: "left" | "right" | "center";
  changed?: boolean;
  heatCap?: number;
}

function formatByType(value: unknown, format?: GridColumnFormat): string {
  if (value == null) return "N/A";
  switch (format) {
    case "price":
      return formatPrice(value as number | string);
    case "pct":
      return formatPct(value as number | string);
    case "large":
      return formatLarge(value as number | string);
    case "ticker":
      return formatTicker(value as string);
    case "date":
      return formatDate(value as string);
    default:
      return String(value);
  }
}

function colorClassFor(value: unknown, format?: GridColumnFormat): string {
  if (format === "pct" || format === "price") {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      if (num > 0) return "text-positive";
      if (num < 0) return "text-negative";
      return "text-neutral";
    }
  }
  return "";
}

const MONO_FORMATS: GridColumnFormat[] = ["price", "pct", "large", "ticker", "date"];

export const GridCell = React.memo(function GridCell({ value, format, align = "left", changed, heatCap }: GridCellProps) {
  if (value == null && format !== "badge") {
    return <span className="text-text-tertiary num">N/A</span>;
  }

  const formatted = formatByType(value, format);
  const monoClass = MONO_FORMATS.includes(format ?? "text") ? "num" : "";
  const colorClass = format === "pct" || format === "price" ? colorClassFor(value, format) : "";
  const alignClass = align === "right" ? "text-right block" : align === "center" ? "text-center block" : "";
  const tickerClass = format === "ticker" ? "font-bold uppercase" : "";

  let heatStyle: React.CSSProperties | undefined;
  if (format === "heatcell" && typeof value === "number" && heatCap) {
    const intensity = Math.min(Math.abs(value) / heatCap, 1) * 0.15;
    const color = value >= 0 ? "34,197,94" : "239,68,68";
    heatStyle = { backgroundColor: `rgba(${color},${intensity})` };
  }

  return (
    <span
      style={heatStyle}
      className={cn(monoClass, colorClass, alignClass, tickerClass, changed && "cell-flash")}
    >
      {formatted}
    </span>
  );
});
