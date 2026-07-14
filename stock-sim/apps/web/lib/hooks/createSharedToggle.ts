"use client";

import { useSyncExternalStore } from "react";

/**
 * Factory for a boolean open/close state shared across components without a
 * React context — used by the command palette and the recent-activity
 * panel so any Global Layout component (Sidebar quick actions, Header
 * triggers) can open them without lifting state through props.
 */
export function createSharedToggle(initial = false) {
  let state = initial;
  const listeners = new Set<() => void>();

  function set(next: boolean) {
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getSnapshot() {
    return state;
  }

  function getServerSnapshot() {
    return initial;
  }

  function useValue(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }

  return { useValue, set, get: getSnapshot, open: () => set(true), close: () => set(false) };
}
