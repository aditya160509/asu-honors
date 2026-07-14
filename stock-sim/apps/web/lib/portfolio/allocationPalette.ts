/**
 * Categorical palette for sector-allocation visualizations. Deliberately avoids market green/red
 * (DESIGN_SPEC reserves these exclusively for price direction) and the iris purple (reserved for
 * AI-content markers) — a monochromatic blue-to-gray ramp built from the existing --mer-accent
 * tokens plus ink grays, so allocation charts stay on-brand without hijacking semantic color.
 */
export const ALLOCATION_PALETTE = ["#3E6FE0", "#7C9EF0", "#3159BE", "#9BA3B0", "#5C6470"];

export function allocationColor(index: number): string {
  return ALLOCATION_PALETTE[index % ALLOCATION_PALETTE.length];
}
