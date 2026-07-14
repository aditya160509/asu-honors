"use client";

import { useSyncExternalStore } from "react";

/**
 * Recent Activity — real events only, never fabricated alerts. There is no
 * notifications backend, so this logs genuine things that happened in this
 * session (navigation, auth, workspace switches) rather than inventing fake
 * content. Capped, localStorage-persisted, in-memory pub/sub so multiple
 * components (bell trigger, panel) stay in sync without prop drilling.
 */
export type ActivityKind = "nav" | "auth" | "workspace" | "system";

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  label: string;
  detail?: string;
  timestamp: number;
}

const STORAGE_KEY = "mer-activity-log";
const MAX_ENTRIES = 20;

let entries: ActivityEntry[] = [];
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
    // ignore quota/serialization errors — activity log is best-effort
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

export function logActivity(input: { kind: ActivityKind; label: string; detail?: string }) {
  hydrate();
  const entry: ActivityEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...input,
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  persist();
  listeners.forEach((listener) => listener());
}

export function useActivityFeed(): ActivityEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
