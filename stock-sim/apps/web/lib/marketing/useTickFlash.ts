"use client";

import * as React from "react";

export type FlashTone = "positive" | "negative";

/**
 * Periodically flags a random cell (by id) as "flashing" for exactly 300ms,
 * alternating pure green/pure red. Consumers apply `.mkt-tick-flash`
 * (app/globals.css — linear 300ms decay to transparent, no easing) plus a
 * `--flash-color` inline style when `activeFlashes[id]` is set.
 */
export function useTickFlash(cellIds: string[], intervalMs = 1100): Record<string, FlashTone> {
  const [active, setActive] = React.useState<Record<string, FlashTone>>({});

  React.useEffect(() => {
    if (cellIds.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      const id = cellIds[Math.floor(Math.random() * cellIds.length)];
      const tone: FlashTone = Math.random() > 0.5 ? "positive" : "negative";
      setActive((prev) => ({ ...prev, [id]: tone }));
      window.setTimeout(() => {
        setActive((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 300);
    }, intervalMs);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellIds.join("|"), intervalMs]);

  return active;
}
