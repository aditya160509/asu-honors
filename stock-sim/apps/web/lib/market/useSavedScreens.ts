"use client";

import * as React from "react";
import { builtinScreens } from "@/lib/market/filters";
import type { MarketFilterState, SavedScreen } from "@/lib/market/types";

const STORAGE_KEY = "market-explorer:saved-screens";

function loadCustom(): SavedScreen[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedScreen[]) : [];
  } catch {
    return [];
  }
}

/** Builtin computed screens (always populated) plus user-saved filter presets. */
export function useSavedScreens() {
  const [custom, setCustom] = React.useState<SavedScreen[]>([]);
  const [activeId, setActiveId] = React.useState<string>("__all");

  React.useEffect(() => {
    setCustom(loadCustom());
  }, []);

  const persist = React.useCallback((next: SavedScreen[]) => {
    setCustom(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable — non-fatal
    }
  }, []);

  const screens = React.useMemo(() => [...builtinScreens(), ...custom], [custom]);

  const saveScreen = React.useCallback(
    (name: string, filters: MarketFilterState, sortKey: string | null, sortDirection: "asc" | "desc" | null) => {
      const id = `custom-${Date.now()}`;
      persist([...custom, { id, name, filters, sortKey, sortDirection }]);
      setActiveId(id);
    },
    [custom, persist]
  );

  const removeScreen = React.useCallback(
    (id: string) => {
      persist(custom.filter((s) => s.id !== id));
      setActiveId((cur) => (cur === id ? "__all" : cur));
    },
    [custom, persist]
  );

  const activeScreen = screens.find((s) => s.id === activeId) ?? screens[0];

  return { screens, activeScreen, activeId, setActiveId, saveScreen, removeScreen };
}
