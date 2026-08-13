"use client";

import * as React from "react";
import { Bookmark, Check, Cloud, CloudOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedScreenResponse, ScreenerPreset, ScreenerQuery, ScreenerViewMode } from "@/lib/api/types";

export interface ScreenerSavedScreensBarProps {
  screens: SavedScreenResponse[];
  authenticated: boolean;
  saving: boolean;
  onSave: (name: string) => void;
  onLoad: (query: ScreenerQuery, viewMode: ScreenerViewMode) => void;
  onRemove: (id: number) => void;
  presets?: ScreenerPreset[];
  onLoadPreset: (query: ScreenerQuery) => void;
}

export function ScreenerSavedScreensBar({ screens, authenticated, saving, onSave, onLoad, onRemove, presets = [], onLoadPreset }: ScreenerSavedScreensBarProps) {
  const [name, setName] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string>("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !authenticated) return;
    onSave(trimmed);
    setName("");
  }

  function load(id: string) {
    setSelectedId(id);
    const screen = screens.find((item) => String(item.id) === id);
    if (screen) onLoad(screen.query, screen.view_mode);
  }

  return (
    <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-b border-[var(--term-hairline)] bg-white/[0.015] px-4 py-1.5 font-mono text-[10px]">
      <span className="flex items-center gap-1.5 uppercase tracking-[0.1em] text-[var(--term-amber)]"><Bookmark size={11} /> Saved research</span>
      <span className="text-[var(--term-ink-tertiary)]">{authenticated ? <><Cloud size={11} className="mr-1 inline text-[var(--term-up)]" />synced</> : <><CloudOff size={11} className="mr-1 inline" />local-only · sign in to sync</>}</span>
      {presets.length > 0 && <select defaultValue="" onChange={(event) => { const preset = presets.find((item) => item.id === event.target.value); if (preset) onLoadPreset(preset.query); event.currentTarget.value = ""; }} aria-label="Load screener preset" className="h-6 max-w-48 border border-[var(--term-divider)] bg-[var(--term-bg)] px-2 text-[11px] text-[var(--term-ink-secondary)] outline-none focus:border-[var(--term-amber)]"><option value="">Presets…</option>{presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select>}
      {authenticated && (
        <form onSubmit={submit} className="flex items-center gap-1">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="name this screen…" aria-label="Saved screen name" className="h-6 w-40 border border-[var(--term-divider)] bg-transparent px-2 text-[11px] text-[var(--term-ink)] outline-none placeholder:text-[var(--term-ink-tertiary)] focus:border-[var(--term-amber)]" />
          <button type="submit" disabled={saving || !name.trim()} className="inline-flex h-6 items-center gap-1 border border-[var(--term-divider)] px-2 uppercase tracking-[0.06em] text-[var(--term-ink-secondary)] transition-colors hover:border-[var(--term-amber)] hover:text-[var(--term-amber)] disabled:cursor-not-allowed disabled:opacity-40"><Check size={10} />{saving ? "Saving" : "Save"}</button>
        </form>
      )}
      {screens.length > 0 && (
        <div className="flex items-center gap-1">
          <select value={selectedId} onChange={(event) => load(event.target.value)} aria-label="Load saved research screen" className="h-6 max-w-52 border border-[var(--term-divider)] bg-[var(--term-bg)] px-2 text-[11px] text-[var(--term-ink-secondary)] outline-none focus:border-[var(--term-amber)]">
            <option value="">Load saved screen…</option>
            {screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.name}</option>)}
          </select>
          {selectedId && <button type="button" onClick={() => { onRemove(Number(selectedId)); setSelectedId(""); }} className={cn("inline-flex h-6 items-center gap-1 px-1.5 text-[var(--term-ink-tertiary)] hover:text-[var(--term-down)]")} aria-label="Delete selected saved screen" title="Delete saved screen"><Trash2 size={11} /></button>}
        </div>
      )}
    </div>
  );
}
