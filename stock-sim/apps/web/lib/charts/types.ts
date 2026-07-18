export interface OHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LinePoint {
  time: number;
  value: number;
}

export interface VisibleRange {
  from: number;
  to: number;
}

export interface ChartRenderCtx {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  padding: { top: number; right: number; bottom: number; left: number };
  xScale: (time: number) => number;
  yScale: (value: number) => number;
  yDomain: [number, number];
  xDomain: [number, number];
}

export type ChartType = "candlestick" | "heikinAshi" | "hollowCandlestick" | "line" | "area" | "baseline" | "ohlcBar";

export interface ChartTypeConfig {
  label: string;
  icon: string;
  description: string;
}

export const CHART_TYPES: Record<ChartType, ChartTypeConfig> = {
  candlestick: { label: "Candlestick", icon: "\ud83d\udd6f\ufe0f", description: "Standard OHLC candles" },
  heikinAshi: { label: "Heikin Ashi", icon: "\ud83d\udcca", description: "Smoothed trend candles" },
  hollowCandlestick: { label: "Hollow", icon: "\ud83d\udd32", description: "Hollow/filled candles" },
  line: { label: "Line", icon: "\ud83d\udcc8", description: "Close price line" },
  area: { label: "Area", icon: "\ud83c\udfd4\ufe0f", description: "Filled area under line" },
  baseline: { label: "Baseline", icon: "\u2696\ufe0f", description: "Above/below baseline" },
  ohlcBar: { label: "OHLC Bar", icon: "\ud83d\udcca", description: "Traditional OHLC bars" },
};
