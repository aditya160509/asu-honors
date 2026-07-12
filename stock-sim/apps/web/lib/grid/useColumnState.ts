"use client";

import * as React from "react";

export interface ColumnState {
  key: string;
  width: number;
  order: number;
  visible: boolean;
}

/** Persists column width/order/visibility to localStorage, keyed by grid id. */
export function useColumnState(gridId: string, defaults: ColumnState[]) {
  const storageKey = `grid-cols:${gridId}`;
  const [columns, setColumns] = React.useState<ColumnState[]>(defaults);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setColumns(JSON.parse(raw));
    } catch {
      // ignore malformed storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = React.useCallback(
    (next: ColumnState[]) => {
      setColumns(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage unavailable — non-fatal
      }
    },
    [storageKey]
  );

  const reset = React.useCallback(() => persist(defaults), [persist, defaults]);

  return { columns, setColumns: persist, reset };
}
