import type { ReactNode } from "react";

export type GridColumnFormat = "price" | "pct" | "large" | "ticker" | "text" | "badge" | "date" | "heatcell" | "sparkline";

export interface GridColumn<T> {
  key: string;
  header: string;
  width: number | "auto" | "grow";
  align?: "left" | "right" | "center";
  render?: (value: unknown, row: T) => ReactNode;
  sortable?: boolean;
  pin?: "left";
  format?: GridColumnFormat;
  /** For 'heatcell' format: value magnitude that maps to full-intensity background. */
  heatCap?: number;
  accessor?: (row: T) => unknown;
}

export type SortDirection = "asc" | "desc" | null;

export interface SortState {
  key: string | null;
  direction: SortDirection;
}
