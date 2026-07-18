import type { Drawing, DrawingPoint, DrawingState, DrawingToolType } from './types';

const LINE_TOOLS: DrawingToolType[] = ['trendline', 'horizontalLine', 'verticalLine'];

export function getRequiredPoints(tool: DrawingToolType): number {
  if (tool === 'text') return 1;
  if (tool === 'parallelChannel') return 3;
  if (tool === 'pitchfork') return 3;
  return 2;
}

export function handleDrawingMouseDown(
  drawing: Drawing,
  mouseX: number,
  mouseY: number,
  xScale: (t: number) => number,
  yScale: (p: number) => number
): DrawingState {
  if (drawing.state === 'selected') {
    for (const pt of drawing.points) {
      const px = xScale(pt.time);
      const py = yScale(pt.price);
      if (Math.abs(mouseX - px) < 8 && Math.abs(mouseY - py) < 8) {
        return 'dragging';
      }
    }
    return 'active';
  }
  return drawing.state;
}

export function handleDrawingMouseMove(
  drawing: Drawing,
  mouseX: number,
  mouseY: number,
  xScale: (t: number) => number,
  yScale: (p: number) => number
): DrawingPoint | null {
  return {
    time: invertXScale(mouseX, xScale),
    price: invertYScale(mouseY, yScale),
  };
}

export function handleDrawingMouseUp(
  drawing: Drawing,
  mouseX: number,
  mouseY: number,
  xScale: (t: number) => number,
  yScale: (p: number) => number
): Drawing {
  if (drawing.type === 'horizontalLine' && drawing.points.length >= 1) {
    return {
      ...drawing,
      points: [
        drawing.points[0],
        { time: invertXScale(mouseX, xScale), price: drawing.points[0].price },
      ],
      state: 'active',
    };
  }
  if (drawing.type === 'verticalLine' && drawing.points.length >= 1) {
    return {
      ...drawing,
      points: [
        drawing.points[0],
        { time: drawing.points[0].time, price: invertYScale(mouseY, yScale) },
      ],
      state: 'active',
    };
  }
  return drawing;
}

function invertXScale(x: number, xScale: (t: number) => number): number {
  let lo = -10000;
  let hi = 10000;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (xScale(mid) < x) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

function invertYScale(y: number, yScale: (p: number) => number): number {
  let lo = -1000000;
  let hi = 1000000;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (yScale(mid) < y) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
