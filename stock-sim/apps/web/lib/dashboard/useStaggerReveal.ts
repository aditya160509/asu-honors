"use client";

import * as React from "react";
import { revealStagger } from "@/lib/motion";

/**
 * Mounts once per dashboard load: staggers every `[data-dashboard-panel]`
 * descendant of the returned ref in from a 16px/opacity-0 rest state. Thin
 * wrapper around the existing `revealStagger` GSAP helper (lib/motion) —
 * no new animation primitive, just a dashboard-scoped entry point for it.
 */
export function useStaggerReveal<T extends HTMLElement>(staggerMs = 45) {
  const containerRef = React.useRef<T>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const panels = el.querySelectorAll("[data-dashboard-panel]");
    if (panels.length === 0) return;
    const tween = revealStagger(panels, staggerMs);
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return containerRef;
}
