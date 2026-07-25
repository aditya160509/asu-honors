"use client";

import * as React from "react";

export interface ChartSurfaceProps {
  height: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  children: (args: { ctx: CanvasRenderingContext2D; width: number; height: number; dpr: number }) => void;
  onPointerMove?: (x: number, y: number) => void;
  onPointerLeave?: () => void;
  onWheel?: (deltaY: number, x: number) => void;
  onPointerDown?: (x: number, y: number, shiftKey: boolean) => void;
  onPointerUp?: () => void;
  onDoubleClick?: () => void;
  className?: string;
}

const DEFAULT_PADDING = { top: 8, right: 8, bottom: 24, left: 64 };

/** DPI-aware Canvas wrapper. Owns a continuous rAF render loop; children draw imperatively every frame. */
export function ChartSurface({
  height,
  padding = DEFAULT_PADDING,
  children,
  onPointerMove,
  onPointerLeave,
  onWheel,
  onPointerDown,
  onPointerUp,
  onDoubleClick,
  className,
}: ChartSurfaceProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const rafRef = React.useRef<number | undefined>(undefined);
  const onWheelRef = React.useRef(onWheel);
  onWheelRef.current = onWheel;

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    const frame = () => {
      if (!running) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      children({ ctx, width, height, dpr });
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      running = false;
    };
  }, [width, height, children]);

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!onPointerMove) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onPointerMove(e.clientX - rect.left, e.clientY - rect.top);
  }

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function handleWheel(e: WheelEvent) {
      const wheel = onWheelRef.current;
      if (!wheel || !canvas) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      wheel(e.deltaY, e.clientX - rect.left);
    }
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!onPointerDown) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onPointerDown(e.clientX - rect.left, e.clientY - rect.top, e.shiftKey);
  }

  return (
    <div ref={containerRef} className={className} style={{ height, width: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        style={{ display: "block", cursor: "crosshair" }}
      />
    </div>
  );
}

export { DEFAULT_PADDING };
