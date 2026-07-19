/** Section 11.5 — PNG export of any chart comparison. ChartSurface's canvas
 * is a plain <canvas> element (lib/charts/core/ChartSurface.tsx), so this
 * calls toDataURL() directly rather than building a custom rasterizer. */
export function exportCanvasPng(canvas: HTMLCanvasElement, filename = "chart.png"): void {
  const url = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}
