// Mirrors engine/orchestrator.py's QUARTER_LENGTH (ticks per fiscal quarter) and its
// tick_count % QUARTER_LENGTH == 0 quarter-boundary rule -- 1 tick = 1 real calendar day
// unconditionally (no weekend/holiday skip), so this is exact, not an estimate.
export const QUARTER_LENGTH = 63;

export interface NextEarnings {
  daysUntil: number;
  date: string;
}

/** Given the simulation's current tick count and sim date, derive the next quarter-boundary
 * (earnings) date the same way the engine itself determines it. */
export function nextEarningsDate(tickCount: number, currentSimDate: string): NextEarnings {
  const daysUntil = QUARTER_LENGTH - (tickCount % QUARTER_LENGTH);
  const next = new Date(currentSimDate + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + daysUntil);
  return { daysUntil, date: next.toISOString().slice(0, 10) };
}
