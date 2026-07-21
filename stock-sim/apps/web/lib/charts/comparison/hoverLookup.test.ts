import { describe, expect, it } from "vitest";
import { nearestIndexForX } from "./hoverLookup";

describe("nearestIndexForX", () => {
  it("maps a pointer x position to the nearest data index", () => {
    // plot area spans x=0..100, 5 points (indices 0-4) -> step of 25px
    expect(nearestIndexForX(0, 100, 5)).toBe(0);
    expect(nearestIndexForX(50, 100, 5)).toBe(2);
    expect(nearestIndexForX(100, 100, 5)).toBe(4);
  });

  it("clamps out-of-range x to the nearest valid index", () => {
    expect(nearestIndexForX(-20, 100, 5)).toBe(0);
    expect(nearestIndexForX(500, 100, 5)).toBe(4);
  });

  it("returns 0 for a single-point series without dividing by zero", () => {
    expect(nearestIndexForX(50, 100, 1)).toBe(0);
  });

  it("returns 0 for an empty series", () => {
    expect(nearestIndexForX(50, 100, 0)).toBe(0);
  });
});
