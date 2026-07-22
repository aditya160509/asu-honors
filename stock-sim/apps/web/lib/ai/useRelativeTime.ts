"use client";

import * as React from "react";

function relativeTimeFrom(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Live-updating "3m ago" label for AI card generation timestamps -- ticks
 * every 15s (coarse enough that a setInterval per card is cheap, fine
 * enough that "just now" turns into "1m ago" without a page refresh). */
export function useRelativeTime(timestamp: number | null): string | null {
  const [, forceTick] = React.useReducer((c: number) => c + 1, 0);

  React.useEffect(() => {
    if (timestamp == null) return;
    const id = setInterval(forceTick, 15_000);
    return () => clearInterval(id);
  }, [timestamp]);

  return timestamp == null ? null : relativeTimeFrom(timestamp);
}
