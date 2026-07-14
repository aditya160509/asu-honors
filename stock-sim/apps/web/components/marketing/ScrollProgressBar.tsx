"use client";

import * as React from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/lib/marketing/useReducedMotion";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/** Thin fixed top-of-viewport progress bar — Action Hue, tracks total page scroll via ScrollTrigger. */
export function ScrollProgressBar() {
  const barRef = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (reduceMotion || !barRef.current) return;
    const bar = barRef.current;

    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        gsap.set(bar, { scaleX: self.progress });
      },
    });

    return () => trigger.kill();
  }, [reduceMotion]);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-[2px] bg-white/5" aria-hidden="true">
      <div ref={barRef} className="h-full w-full origin-left bg-mkt-action" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}
