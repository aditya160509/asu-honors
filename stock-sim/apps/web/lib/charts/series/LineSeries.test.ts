import { describe, expect, it, vi } from "vitest";
import { drawLineSeries } from "./LineSeries";

const PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

function makeMockCtx() {
  const calls: { moveTo: number[]; lineTo: number[]; quadraticCurveTo: number[][] } = {
    moveTo: [],
    lineTo: [],
    quadraticCurveTo: [],
  };
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fill: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn((x: number) => calls.moveTo.push(x)),
    lineTo: vi.fn((x: number) => calls.lineTo.push(x)),
    quadraticCurveTo: vi.fn((x0: number, y0: number, x1: number) => calls.quadraticCurveTo.push([x0, x1])),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe("drawLineSeries", () => {
  it("without timeDomain, stretches a series to fill the full plot width using its own [first, last] time", () => {
    const { ctx, calls } = makeMockCtx();
    const data = [
      { time: 0, value: 1 },
      { time: 1, value: 2 },
    ];
    drawLineSeries({ ctx, data, width: 100, height: 100, padding: PADDING, yDomain: [0, 2] });
    // 2-point series: first point at x=0 (moveTo), second point's endpoint
    // reached via the final lineTo in drawSmoothPath -- both at the plot edges.
    expect(calls.moveTo[0]).toBeCloseTo(0);
    expect(calls.lineTo[calls.lineTo.length - 1]).toBeCloseTo(100);
  });

  it("with an explicit timeDomain wider than the series' own range, does NOT stretch to fill the width", () => {
    const { ctx, calls } = makeMockCtx();
    // A 2-point branch series (time 0..1) plotted against a shared domain of
    // 0..9 (a 10-point sibling series) -- this is exactly the Future Lab
    // timeline-comparison / multi-ticker-overlay scenario: a shorter series
    // must NOT stretch to fill the same pixel width as the longest one,
    // since the hover tooltip indexes every series by the same shared index
    // and assumes each index maps to the same pixel position everywhere.
    const data = [
      { time: 0, value: 1 },
      { time: 1, value: 2 },
    ];
    drawLineSeries({ ctx, data, width: 100, height: 100, padding: PADDING, yDomain: [0, 2], timeDomain: [0, 9] });
    expect(calls.moveTo[0]).toBeCloseTo(0);
    // Point at time=1 out of a 0..9 domain should land at 1/9 of the width,
    // NOT at the far right edge (100) as the no-timeDomain case above does.
    expect(calls.lineTo[calls.lineTo.length - 1]).toBeCloseTo(100 / 9, 1);
  });

  it("two series sharing a timeDomain place identical time values at identical pixel x", () => {
    // A single-point-past-start series and a multi-point series, both
    // reporting a point at time=1 -- with a shared [0, 2] domain, time=1
    // must land at the same x (45) for both regardless of how many total
    // points either series has, which is the property that makes a
    // shared-index hover tooltip trustworthy across series of different
    // lengths (e.g. a 50-day branch vs. its 174-day parent).
    const shortSeries = [
      { time: 0, value: 1 },
      { time: 1, value: 2 },
    ];
    const longSeries = [
      { time: 0, value: 5 },
      { time: 1, value: 6 },
      { time: 2, value: 7 },
    ];
    const sharedDomain: [number, number] = [0, 2];

    const short = makeMockCtx();
    drawLineSeries({ ctx: short.ctx, data: shortSeries, width: 90, height: 100, padding: PADDING, yDomain: [0, 10], timeDomain: sharedDomain });

    const long = makeMockCtx();
    drawLineSeries({ ctx: long.ctx, data: longSeries, width: 90, height: 100, padding: PADDING, yDomain: [0, 10], timeDomain: sharedDomain });

    // short series' last point (time=1) is its final lineTo; long series'
    // time=1 point is its middle segment, reached via quadraticCurveTo's
    // control point (x0) on the way to the midpoint with the next segment.
    const shortTimeOneX = short.calls.lineTo[short.calls.lineTo.length - 1];
    const longTimeOneX = long.calls.quadraticCurveTo[1][0];
    expect(shortTimeOneX).toBeCloseTo(longTimeOneX);
    expect(shortTimeOneX).toBeCloseTo(45);
  });
});
