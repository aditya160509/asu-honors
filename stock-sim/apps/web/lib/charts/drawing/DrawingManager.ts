import type { Drawing, DrawingPoint, DrawingToolType } from './types';
import { getRequiredPoints } from './interactions';

export class DrawingManager {
  drawings: Drawing[] = [];
  activeTool: DrawingToolType | null = null;
  selectedId: string | null = null;
  private listeners: (() => void)[] = [];

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  addDrawing(drawing: Drawing): void {
    this.drawings.push(drawing);
    this.notify();
  }

  removeDrawing(id: string): void {
    this.drawings = this.drawings.filter((d) => d.id !== id);
    if (this.selectedId === id) this.selectedId = null;
    this.notify();
  }

  updateDrawing(id: string, updates: Partial<Drawing>): void {
    const d = this.drawings.find((d) => d.id === id);
    if (d) {
      Object.assign(d, updates);
      this.notify();
    }
  }

  selectDrawing(id: string | null): void {
    this.selectedId = id;
    this.notify();
  }

  setActiveTool(tool: DrawingToolType | null): void {
    this.activeTool = tool;
    this.notify();
  }

  getDrawings(): Drawing[] {
    return this.drawings;
  }

  clear(): void {
    this.drawings = [];
    this.selectedId = null;
    this.notify();
  }

  hitTest(
    x: number,
    y: number,
    xScale: (t: number) => number,
    yScale: (p: number) => number,
    threshold = 8
  ): Drawing | null {
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i];
      if (d.points.length === 0) continue;

      for (const pt of d.points) {
        const px = xScale(pt.time);
        const py = yScale(pt.price);
        if (Math.abs(x - px) < threshold && Math.abs(y - py) < threshold) {
          return d;
        }
      }

      if (d.points.length === 2) {
        const p0 = d.points[0];
        const p1 = d.points[1];
        const x0 = xScale(p0.time);
        const y0 = yScale(p0.price);
        const x1 = xScale(p1.time);
        const y1 = yScale(p1.price);

        const dx = x1 - x0;
        const dy = y1 - y0;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;

        let t = ((x - x0) * dx + (y - y0) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const projX = x0 + t * dx;
        const projY = y0 + t * dy;
        const dist = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);

        if (dist < threshold) return d;
      }
    }
    return null;
  }

  toJSON(): Record<string, unknown>[] {
    return this.drawings.map((d) => ({
      id: d.id,
      type: d.type,
      points: d.points,
      style: d.style,
      label: d.label,
    }));
  }

  fromJSON(data: Record<string, unknown>[]): void {
    this.drawings = data.map((d) => ({
      id: d.id as string,
      type: d.type as DrawingToolType,
      points: d.points as DrawingPoint[],
      state: 'active' as const,
      style: d.style as Drawing['style'],
      label: d.label as string | undefined,
    }));
    this.notify();
  }
}
