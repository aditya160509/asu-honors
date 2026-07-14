"use client";

import * as React from "react";
import gsap from "gsap";
import { MktSkeleton } from "@/components/marketing/MktSkeleton";
import { EASE_OUT_EXPO } from "@/lib/motion";
import { useReducedMotion } from "@/lib/marketing/useReducedMotion";

const STATS = [
  { label: "EPS", value: "6.42" },
  { label: "P/E", value: "28.7" },
  { label: "DIV YIELD", value: "0.58%" },
  { label: "MARKET CAP", value: "$2.91T" },
];

export interface ExecutiveTearSheetProps {
  /** Illustrative marketing mock — not wired to a real ticker. */
  simulatedLoadMs?: number;
}

/** Top-level summary strip — EPS/P/E/Dividend Yield/Market Cap, right-aligned tabular figures. */
export function ExecutiveTearSheet({ simulatedLoadMs = 500 }: ExecutiveTearSheetProps) {
  const [loading, setLoading] = React.useState(true);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), simulatedLoadMs);
    return () => window.clearTimeout(t);
  }, [simulatedLoadMs]);

  React.useEffect(() => {
    if (loading || !containerRef.current) return;
    const values = containerRef.current.querySelectorAll("[data-value]");
    if (reduceMotion) {
      gsap.set(values, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(values, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: EASE_OUT_EXPO, stagger: 0.05 });
  }, [loading, reduceMotion]);

  return (
    <div ref={containerRef} className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4">
      {STATS.map((stat) => (
        <div
          key={stat.label}
          className="mkt-card-lit flex flex-col items-end gap-grid-1 bg-mkt-bg-void px-grid-4 py-grid-4"
        >
          <span className="w-full text-left text-micro uppercase tracking-wide text-mkt-text-muted">
            {stat.label}
          </span>
          {loading ? (
            <MktSkeleton width={64} height={20} />
          ) : (
            <span data-value className="num text-h3 font-semibold text-mkt-text-hero">
              {stat.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
