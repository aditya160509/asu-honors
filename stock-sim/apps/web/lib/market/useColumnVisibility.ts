"use client";

import * as React from "react";
import type { ColumnDef, ColumnKey } from "@/lib/market/types";

const STORAGE_KEY = "market-explorer:columns";

interface StoredColumnState {
  order: ColumnKey[];
  hidden: ColumnKey[];
}

function load(defaultOrder: ColumnKey[], defaultHidden: ColumnKey[]): StoredColumnState {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredColumnState;
        if (Array.isArray(parsed.order) && Array.isArray(parsed.hidden)) {
          const known = new Set(defaultOrder);
          const order = parsed.order.filter((k) => known.has(k));
          for (const k of defaultOrder) if (!order.includes(k)) order.push(k);
          return { order, hidden: parsed.hidden.filter((k) => known.has(k)) };
        }
      }
    } catch {
      // ignore malformed storage
    }
  }
  return { order: defaultOrder, hidden: defaultHidden };
}

/** Persists Market Explorer column order/visibility to localStorage — scoped to this page only. */
export function useColumnVisibility(allColumns: ColumnDef[], defaultHidden: ColumnKey[] = []) {
  const defaultOrder = React.useMemo(() => allColumns.map((c) => c.key), [allColumns]);
  const [state, setState] = React.useState<StoredColumnState>(() => ({ order: defaultOrder, hidden: defaultHidden }));

  React.useEffect(() => {
    setState(load(defaultOrder, defaultHidden));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = React.useCallback((next: StoredColumnState) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable — non-fatal
    }
  }, []);

  const byKey = React.useMemo(() => new Map(allColumns.map((c) => [c.key, c])), [allColumns]);

  const orderedVisible = React.useMemo(
    () => state.order.filter((k) => !state.hidden.includes(k)).map((k) => byKey.get(k)!).filter(Boolean),
    [state, byKey]
  );

  const toggle = React.useCallback(
    (key: ColumnKey) => {
      const hidden = state.hidden.includes(key) ? state.hidden.filter((k) => k !== key) : [...state.hidden, key];
      persist({ ...state, hidden });
    },
    [state, persist]
  );

  const move = React.useCallback(
    (key: ColumnKey, direction: -1 | 1) => {
      const idx = state.order.indexOf(key);
      const swapWith = idx + direction;
      if (swapWith < 0 || swapWith >= state.order.length) return;
      const order = [...state.order];
      [order[idx], order[swapWith]] = [order[swapWith], order[idx]];
      persist({ ...state, order });
    },
    [state, persist]
  );

  const reset = React.useCallback(() => persist({ order: defaultOrder, hidden: defaultHidden }), [defaultOrder, defaultHidden, persist]);

  return { order: state.order, hidden: state.hidden, orderedVisible, toggle, move, reset };
}
