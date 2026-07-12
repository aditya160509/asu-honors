import { drawLineSeries, type LineSeriesDrawArgs } from "@/lib/charts/series/LineSeries";

/** AreaSeries is a LineSeries with a required fill — thin wrapper for call-site clarity. */
export function drawAreaSeries(args: Omit<LineSeriesDrawArgs, "fill"> & { fill: string }): void {
  drawLineSeries(args);
}
