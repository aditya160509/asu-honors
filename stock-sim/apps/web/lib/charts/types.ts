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
  candlestick: { label: "Candlestick", icon: "C", description: "Standard OHLC candles" },
  heikinAshi: { label: "Heikin Ashi", icon: "HA", description: "Smoothed trend candles" },
  hollowCandlestick: { label: "Hollow", icon: "HC", description: "Hollow/filled candles" },
  line: { label: "Line", icon: "L", description: "Close price line" },
  area: { label: "Area", icon: "A", description: "Filled area under line" },
  baseline: { label: "Baseline", icon: "B", description: "Above/below baseline" },
  ohlcBar: { label: "OHLC Bar", icon: "O", description: "Traditional OHLC bars" },
};
