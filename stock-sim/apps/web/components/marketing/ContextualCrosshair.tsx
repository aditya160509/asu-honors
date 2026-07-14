"use client";

import * as React from "react";

export interface ContextualCrosshairProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps data-dense content (Cross-Asset Matrix, tear sheet, order ticket).
 * While hovered, replaces the default cursor with a full-span razor-thin
 * crosshair that tracks the pointer — the default cursor is hidden via
 * `cursor-none` rather than removed from the DOM, so no layout/measurement
 * cost, and pointer events on children are untouched.
 */
export function ContextualCrosshair({ children, className }: ContextualCrosshairProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const lineVRef = React.useRef<HTMLDivElement>(null);
  const lineHRef = React.useRef<HTMLDivElement>(null);
  const rafRef = React.useRef<number | undefined>(undefined);
  const [active, setActive] = React.useState(false);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (lineVRef.current) lineVRef.current.style.left = `${x}px`;
      if (lineHRef.current) lineHRef.current.style.top = `${y}px`;
    });
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${active ? "cursor-none" : ""} ${className ?? ""}`}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onMouseMove={handleMouseMove}
    >
      {children}
      {active && (
        <>
          <div ref={lineVRef} className="pointer-events-none absolute inset-y-0 w-px bg-mkt-action/70" />
          <div ref={lineHRef} className="pointer-events-none absolute inset-x-0 h-px bg-mkt-action/70" />
        </>
      )}
    </div>
  );
}
