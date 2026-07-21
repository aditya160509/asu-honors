export interface AxisLabel {
  x: number;
  text: string;
}

/** Timeline comparisons plot every series by shared array index, not calendar
 * date (see findDivergenceIndex) -- a branch's index 0 is its own branch
 * point, not the parent's, so labeling the shared x-axis with any one
 * series' real calendar dates misrepresents every other series. "Day N" is
 * the only label that's true for all of them at once: N ticks since each
 * series' own start. */
export function relativeDayAxisLabels(length: number, stepInterval: number): AxisLabel[] {
  const step = Math.max(1, stepInterval);
  const labels: AxisLabel[] = [];
  for (let i = 0; i < length; i += step) {
    labels.push({ x: i, text: `Day ${i}` });
  }
  return labels;
}
