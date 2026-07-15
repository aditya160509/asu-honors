"use client";

import * as React from "react";
import gsap from "gsap";
import { MktSkeleton } from "@/components/marketing/MktSkeleton";
import { useTickFlash } from "@/lib/marketing/useTickFlash";
import { EASE_OUT_EXPO } from "@/lib/motion";
import { useReducedMotion } from "@/lib/marketing/useReducedMotion";

interface Cell {
  id: string;
  row: string;
  col: string;
  value: string;
}

const ROWS = ["EQUITIES", "FIXED INCOME", "FX", "COMMODITIES"];
const COLS = ["EQ", "FI", "FX", "CMDTY"];

function buildCells(): Cell[] {
  const cells: Cell[] = [];
  for (const row of ROWS) {
    for (const col of COLS) {
      const id = `${row}:${col}`;
      const value = row === col.slice(0, row.length) ? "1.00" : (Math.random() * 2 - 1).toFixed(2);
      cells.push({ id, row, col, value });
    }
  }
  return cells;
}

const FLASH_COLOR = { positive: "var(--positive)", negative: "var(--negative)" };

/**
 * Dense correlation grid. 1px sub-pixel borders react to cursor proximity via
 * a single cursor-tracked radial-gradient overlay (cheaper and more reliable
 * than gradient-per-border-segment, same visual result), layered with a
 * per-cell hover glow (.mkt-card-lit) so both the whole-grid proximity cue
 * and the directly-hovered cell read clearly. Random cells tick-flash pure
 * green/red for exactly 300ms via useTickFlash.
 */
export function CrossAssetMatrix({ simulatedLoadMs = 700 }: { simulatedLoadMs?: number }) {
  const [loading, setLoading] = React.useState(true);
  const cells = React.useMemo(buildCells, []);
  const cellIds = React.useMemo(() => cells.map((c) => c.id), [cells]);
  const flashes = useTickFlash(cellIds);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), simulatedLoadMs);
    return () => window.clearTimeout(t);
  }, [simulatedLoadMs]);

  React.useEffect(() => {
    if (loading || !gridRef.current) return;
    const rows = gridRef.current.querySelectorAll("[data-matrix-cell]");
    if (reduceMotion) {
      gsap.set(rows, { opacity: 1, scale: 1 });
      return;
    }
    gsap.fromTo(
      rows,
      { opacity: 0, scale: 0.94 },
      { opacity: 1, scale: 1, duration: 0.3, ease: EASE_OUT_EXPO, stagger: { each: 0.015, grid: [4, 4], from: "start" } }
    );
  }, [loading, reduceMotion]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = gridRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-px bg-white/5">
        {Array.from({ length: ROWS.length * COLS.length }).map((_, i) => (
          <MktSkeleton key={i} height={56} />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      onMouseMove={handleMouseMove}
      className="relative grid grid-cols-4 gap-px overflow-hidden bg-white/10"
      style={{ ["--mx" as string]: "50%", ["--my" as string]: "50%" }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-150 hover:opacity-100"
        style={{
          background: "radial-gradient(160px circle at var(--mx) var(--my), rgba(255,255,255,0.14), transparent 65%)",
        }}
      />
      {cells.map((cell) => {
        const flash = flashes[cell.id];
        return (
          <div
            key={cell.id}
            data-matrix-cell
            className={`mkt-card-lit num flex items-center justify-end bg-mkt-bg-void px-grid-3 py-grid-4 text-body ${
              flash ? "mkt-tick-flash" : ""
            }`}
            style={flash ? ({ ["--flash-color" as string]: FLASH_COLOR[flash] } as React.CSSProperties) : undefined}
          >
            {cell.value}
          </div>
        );
      })}
    </div>
  );
}
