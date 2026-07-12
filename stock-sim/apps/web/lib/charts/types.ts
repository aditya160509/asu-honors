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
