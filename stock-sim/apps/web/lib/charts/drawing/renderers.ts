import type { Drawing, DrawingStyle } from './types';
import type { OHLC } from '@/lib/charts/types';

const LINE_DASH_MAP: Record<string, number[]> = {
  solid: [],
  dashed: [8, 4],
  dotted: [2, 4],
};

function applyStyle(ctx: CanvasRenderingContext2D, style: DrawingStyle) {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.lineWidth;
  ctx.setLineDash(LINE_DASH_MAP[style.lineStyle] ?? []);
}

function restoreStyle(ctx: CanvasRenderingContext2D) {
  ctx.setLineDash([]);
}

export function renderSelectionHandles(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number
) {
  if (drawing.state !== 'selected') return;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = drawing.style.color;
  ctx.lineWidth = 1.5;
  for (const pt of drawing.points) {
    const x = xScale(pt.time) - 3;
    const y = yScale(pt.price) - 3;
    ctx.fillRect(x, y, 6, 6);
    ctx.strokeRect(x, y, 6, 6);
  }
  ctx.restore();
}

export function renderTrendline(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number
) {
  if (drawing.points.length < 2) return;
  ctx.save();
  applyStyle(ctx, drawing.style);
  ctx.beginPath();
  ctx.moveTo(xScale(drawing.points[0].time), yScale(drawing.points[0].price));
  ctx.lineTo(xScale(drawing.points[1].time), yScale(drawing.points[1].price));
  ctx.stroke();
  restoreStyle(ctx);
  ctx.restore();
}

export function renderHorizontalLine(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number,
  width: number
) {
  if (drawing.points.length < 1) return;
  ctx.save();
  applyStyle(ctx, drawing.style);
  const y = yScale(drawing.points[0].price);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  restoreStyle(ctx);
  ctx.restore();
}

export function renderVerticalLine(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number,
  _height: number
) {
  if (drawing.points.length < 1) return;
  ctx.save();
  applyStyle(ctx, drawing.style);
  const x = xScale(drawing.points[0].time);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, _height);
  ctx.stroke();
  restoreStyle(ctx);
  ctx.restore();
}

export function renderFibonacciRetracement(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number
) {
  if (drawing.points.length < 2) return;
  const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const p0 = drawing.points[0];
  const p1 = drawing.points[1];
  const priceRange = p1.price - p0.price;
  const x0 = xScale(p0.time);
  const x1 = xScale(p1.time);
  const y0 = yScale(p0.price);

  ctx.save();
  applyStyle(ctx, drawing.style);
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';

  for (const level of levels) {
    const price = p0.price + priceRange * level;
    const y = yScale(price);

    ctx.globalAlpha = level === 0 || level === 1 ? 0.8 : 0.5;
    ctx.beginPath();
    ctx.moveTo(Math.min(x0, x1), y);
    ctx.lineTo(Math.max(x0, x1), y);
    ctx.stroke();

    ctx.fillStyle = drawing.style.color;
    ctx.globalAlpha = 0.9;
    ctx.fillText(`${(level * 100).toFixed(1)}%`, Math.min(x0, x1) - 4, y - 3);
  }

  ctx.globalAlpha = 1;
  restoreStyle(ctx);
  ctx.restore();
}

export function renderFibonacciExtension(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number
) {
  if (drawing.points.length < 2) return;
  const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618];
  const p0 = drawing.points[0];
  const p1 = drawing.points[1];
  const priceRange = p1.price - p0.price;
  const x0 = xScale(p0.time);
  const x1 = xScale(p1.time);

  ctx.save();
  applyStyle(ctx, drawing.style);
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';

  for (const level of levels) {
    const price = p0.price + priceRange * level;
    const y = yScale(price);

    ctx.globalAlpha = level <= 1 ? 0.5 : 0.35;
    ctx.beginPath();
    ctx.moveTo(Math.min(x0, x1), y);
    ctx.lineTo(Math.max(x0, x1), y);
    ctx.stroke();

    ctx.fillStyle = drawing.style.color;
    ctx.globalAlpha = 0.9;
    ctx.fillText(`${(level * 100).toFixed(1)}%`, Math.min(x0, x1) - 4, y - 3);
  }

  ctx.globalAlpha = 1;
  restoreStyle(ctx);
  ctx.restore();
}

export function renderRectangle(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number
) {
  if (drawing.points.length < 2) return;
  const p0 = drawing.points[0];
  const p1 = drawing.points[1];
  const x = Math.min(xScale(p0.time), xScale(p1.time));
  const y = Math.min(yScale(p0.price), yScale(p1.price));
  const w = Math.abs(xScale(p1.time) - xScale(p0.time));
  const h = Math.abs(yScale(p1.price) - yScale(p0.price));

  ctx.save();
  if (drawing.style.fillColor) {
    ctx.fillStyle = drawing.style.fillColor;
    ctx.fillRect(x, y, w, h);
  }
  applyStyle(ctx, drawing.style);
  ctx.strokeRect(x, y, w, h);
  restoreStyle(ctx);
  ctx.restore();
}

export function renderEllipse(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number
) {
  if (drawing.points.length < 2) return;
  const p0 = drawing.points[0];
  const p1 = drawing.points[1];
  const cx = (xScale(p0.time) + xScale(p1.time)) / 2;
  const cy = (yScale(p0.price) + yScale(p1.price)) / 2;
  const rx = Math.abs(xScale(p1.time) - xScale(p0.time)) / 2;
  const ry = Math.abs(yScale(p1.price) - yScale(p0.price)) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

  if (drawing.style.fillColor) {
    ctx.fillStyle = drawing.style.fillColor;
    ctx.fill();
  }
  applyStyle(ctx, drawing.style);
  ctx.stroke();
  restoreStyle(ctx);
  ctx.restore();
}

export function renderArrow(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number
) {
  if (drawing.points.length < 2) return;
  const p0 = drawing.points[0];
  const p1 = drawing.points[1];
  const x0 = xScale(p0.time);
  const y0 = yScale(p0.price);
  const x1 = xScale(p1.time);
  const y1 = yScale(p1.price);

  const angle = Math.atan2(y1 - y0, x1 - x0);
  const headLen = 10;

  ctx.save();
  applyStyle(ctx, drawing.style);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(
    x1 - headLen * Math.cos(angle - Math.PI / 6),
    y1 - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(x1, y1);
  ctx.lineTo(
    x1 - headLen * Math.cos(angle + Math.PI / 6),
    y1 - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
  restoreStyle(ctx);
  ctx.restore();
}

export function renderText(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number
) {
  if (drawing.points.length < 1 || !drawing.label) return;
  ctx.save();
  ctx.fillStyle = drawing.style.color;
  ctx.font = `${drawing.style.fontSize ?? 13}px "JetBrains Mono", monospace`;
  ctx.textBaseline = 'top';
  ctx.fillText(drawing.label, xScale(drawing.points[0].time), yScale(drawing.points[0].price));
  ctx.restore();
}

export function renderParallelChannel(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number
) {
  if (drawing.points.length < 3) return;
  const [p0, p1, p2] = drawing.points;
  const x0 = xScale(p0.time);
  const y0 = yScale(p0.price);
  const x1 = xScale(p1.time);
  const y1 = yScale(p1.price);
  const x2 = xScale(p2.time);
  const y2 = yScale(p2.price);

  const dx = x1 - x0;
  const dy = y1 - y0;

  ctx.save();
  applyStyle(ctx, drawing.style);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + dx, y2 + dy);
  ctx.stroke();

  if (drawing.style.fillColor) {
    ctx.fillStyle = drawing.style.fillColor;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2 + dx, y2 + dy);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.fill();
  }
  restoreStyle(ctx);
  ctx.restore();
}

export function renderPitchfork(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number
) {
  if (drawing.points.length < 3) return;
  const [p0, p1, p2] = drawing.points;
  const x0 = xScale(p0.time);
  const y0 = yScale(p0.price);
  const x1 = xScale(p1.time);
  const y1 = yScale(p1.price);
  const x2 = xScale(p2.time);
  const y2 = yScale(p2.price);

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const forkLen = 1.5;
  const dx = midX - x0;
  const dy = midY - y0;

  ctx.save();
  applyStyle(ctx, drawing.style);

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + dx * forkLen, y0 + dy * forkLen);
  ctx.stroke();

  const upperDx = x1 - midX;
  const upperDy = y1 - midY;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + upperDx * forkLen, y1 + upperDy * forkLen);
  ctx.stroke();

  const lowerDx = x2 - midX;
  const lowerDy = y2 - midY;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + lowerDx * forkLen, y2 + lowerDy * forkLen);
  ctx.stroke();

  restoreStyle(ctx);
  ctx.restore();
}

export function renderCallout(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number
) {
  if (drawing.points.length < 2 || !drawing.label) return;
  const p0 = drawing.points[0];
  const p1 = drawing.points[1];
  const x0 = xScale(p0.time);
  const y0 = yScale(p0.price);
  const x1 = xScale(p1.time);
  const y1 = yScale(p1.price);

  ctx.save();
  ctx.font = `${drawing.style.fontSize ?? 12}px "JetBrains Mono", monospace`;
  const textW = ctx.measureText(drawing.label).width;
  const pad = 8;
  const boxW = textW + pad * 2;
  const boxH = 24;

  ctx.beginPath();
  ctx.moveTo(x1 - boxW / 2, y1 - boxH);
  ctx.lineTo(x1 + boxW / 2, y1 - boxH);
  ctx.lineTo(x1 + boxW / 2, y1);
  ctx.lineTo(x1 + 6, y1);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x1 - 6, y1);
  ctx.lineTo(x1 - boxW / 2, y1);
  ctx.closePath();

  ctx.fillStyle = '#121214';
  ctx.fill();
  applyStyle(ctx, drawing.style);
  ctx.stroke();

  ctx.fillStyle = drawing.style.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(drawing.label, x1, y1 - boxH / 2);

  restoreStyle(ctx);
  ctx.restore();
}

export function renderMeasure(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number,
  _data?: OHLC[]
) {
  if (drawing.points.length < 2) return;
  const p0 = drawing.points[0];
  const p1 = drawing.points[1];
  const x0 = xScale(p0.time);
  const y0 = yScale(p0.price);
  const x1 = xScale(p1.time);
  const y1 = yScale(p1.price);

  const priceDiff = p1.price - p0.price;
  const pctChange = ((priceDiff / p0.price) * 100).toFixed(2);
  const timeDiff = Math.abs(p1.time - p0.time);

  ctx.save();
  applyStyle(ctx, drawing.style);
  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);

  const midX = (x0 + x1) / 2;
  const midY = (y0 + y1) / 2;
  const label = `${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${pctChange}%) | ${timeDiff} bars`;

  ctx.font = '11px "JetBrains Mono", monospace';
  const textW = ctx.measureText(label).width;
  const pad = 6;

  ctx.fillStyle = '#121214';
  ctx.fillRect(midX - textW / 2 - pad, midY - 10, textW + pad * 2, 20);
  ctx.strokeStyle = drawing.style.color;
  ctx.lineWidth = 1;
  ctx.strokeRect(midX - textW / 2 - pad, midY - 10, textW + pad * 2, 20);

  ctx.fillStyle = drawing.style.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, midX, midY);

  ctx.restore();
}

const RENDERERS: Record<
  string,
  (
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    xScale: (t: number) => number,
    yScale: (p: number) => number,
    width: number,
    height: number,
    data?: OHLC[]
  ) => void
> = {
  trendline: (ctx, d, xs, ys) => renderTrendline(ctx, d, xs, ys),
  horizontalLine: (ctx, d, xs, ys, w) => renderHorizontalLine(ctx, d, xs, ys, w),
  verticalLine: (ctx, d, xs, ys, _w, h) => renderVerticalLine(ctx, d, xs, ys, h),
  fibonacciRetracement: (ctx, d, xs, ys) => renderFibonacciRetracement(ctx, d, xs, ys),
  fibonacciExtension: (ctx, d, xs, ys) => renderFibonacciExtension(ctx, d, xs, ys),
  rectangle: (ctx, d, xs, ys) => renderRectangle(ctx, d, xs, ys),
  ellipse: (ctx, d, xs, ys) => renderEllipse(ctx, d, xs, ys),
  arrow: (ctx, d, xs, ys) => renderArrow(ctx, d, xs, ys),
  text: (ctx, d, xs, ys) => renderText(ctx, d, xs, ys),
  parallelChannel: (ctx, d, xs, ys) => renderParallelChannel(ctx, d, xs, ys),
  pitchfork: (ctx, d, xs, ys) => renderPitchfork(ctx, d, xs, ys),
  callout: (ctx, d, xs, ys) => renderCallout(ctx, d, xs, ys),
  measure: (ctx, d, xs, ys, w, h, data) => renderMeasure(ctx, d, xs, ys, data),
};

export function renderDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  xScale: (t: number) => number,
  yScale: (p: number) => number,
  width: number,
  height: number,
  data?: OHLC[]
) {
  const renderer = RENDERERS[drawing.type];
  if (renderer) {
    renderer(ctx, drawing, xScale, yScale, width, height, data);
  }
  renderSelectionHandles(ctx, drawing, xScale, yScale);
}
