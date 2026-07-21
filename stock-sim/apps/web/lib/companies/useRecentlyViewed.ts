"use client";

import { useSyncExternalStore } from "react";

/**
 * Recently-viewed companies -- localStorage-persisted, in-memory pub/sub
 * (same useSyncExternalStore shape as lib/activity/useActivityLog.ts), so
 * multiple mounts (dashboard section, any future usage) stay in sync without
 * prop drilling. Deduped by ticker: re-viewing a company moves it back to
 * the front rather than creating a second entry.
 */
export interface RecentlyViewedEntry {
  ticker: string;
  name: string;
  timestamp: number;
}

const STORAGE_KEY = "mer-recently-viewed-companies";
const MAX_ENTRIES = 8;

let entries: RecentlyViewedEntry[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) entries = JSON.parse(raw);
  } catch {
    entries = [];
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota/serialization errors -- best-effort only
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  hydrate();
  return entries;
}

function getServerSnapshot() {
  return entries;
}

export function logCompanyView(ticker: string, name: string) {
  hydrate();
  const withoutTicker = entries.filter((e) => e.ticker !== ticker);
  entries = [{ ticker, name, timestamp: Date.now() }, ...withoutTicker].slice(0, MAX_ENTRIES);
  persist();
  listeners.forEach((listener) => listener());
}

export function useRecentlyViewed(): RecentlyViewedEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Test-only seam: this module's `entries` is an intentional module-level
 * singleton (mirrors useActivityLog.ts), which otherwise leaks state between
 * test cases with no way to reset it from outside. */
export function __resetForTests() {
  entries = [];
  hydrated = false;
}
