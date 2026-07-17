"use client";

import * as React from "react";
import { X } from "lucide-react";

export interface HelpOverlayProps {
  open: boolean;
  onClose: () => void;
}

const GRAMMAR_ROWS: [string, string][] = [
  ["<text>", "Fuzzy match ticker/name"],
  ["cap:mega|large|mid|small|micro", "Filter by market-cap tier (comma-list ok)"],
  ["sector:<code>", "Filter by sector code — see F key list below or the f overlay"],
  ["chg>N / chg<N", "Day change % above/below N"],
  ["price>N / price<N", "Price above/below N"],
  ["ivgap>N / ivgap<N", "IV gap % above/below N"],
  ["vol>1m / vol<500k", "Volume above/below N (k/m/b units)"],
];

const COMMAND_ROWS: [string, string][] = [
  [">save <name>", "Save the current filters + sort as a screen"],
  [">load <name>", "Load a saved screen"],
  [">cols", "Open the column manager"],
  [">export", "Export current rows as CSV"],
  [">hmp / >tbl", "Switch to heatmap / table view"],
  [">dense", "Toggle terminal row density"],
  [">help", "This cheat-sheet"],
];

const KEY_ROWS: [string, string][] = [
  ["/ or ⌘K", "Focus the command line"],
  ["f", "Open the Filter Overlay"],
  ["j / k or ↓ / ↑", "Move row focus"],
  ["Enter / Space", "Open detail panel for focused row"],
  ["w", "Toggle watchlist"],
  ["y", "Copy focused row as tab-separated text"],
  ["s then A/B/C…", "Sort by that column's letter"],
  ["F1–F6", "Load saved screens 1–6"],
  ["⌘D", "Toggle density"],
  ["Esc", "Close overlay / detail panel"],
];

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div className="flex flex-col gap-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-3 font-mono text-[13px]">
          <span className="w-56 shrink-0 text-[color:var(--term-amber)]">{k}</span>
          <span className="text-[color:var(--term-ink-secondary)]">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function HelpOverlay({ open, onClose }: HelpOverlayProps) {
  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 pt-16">
      <div className="w-[560px] max-w-[92vw] border border-[var(--term-divider)] bg-[var(--term-bg)] shadow-[0_8px_24px_rgba(4,6,10,0.5)]">
        <div className="flex items-center justify-between border-b border-[var(--term-divider)] px-4 py-2">
          <span className="font-mono text-[13px] font-semibold text-[var(--term-amber)]">SCRN&gt; HELP</span>
          <button type="button" onClick={onClose} aria-label="Close help" className="text-[var(--term-ink-tertiary)] hover:text-[var(--term-ink)]">
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-4 px-4 py-3">
          <div>
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-ink-tertiary)]">Command-line grammar</div>
            <Table rows={GRAMMAR_ROWS} />
          </div>
          <div>
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-ink-tertiary)]">Commands (type &gt;)</div>
            <Table rows={COMMAND_ROWS} />
          </div>
          <div>
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-ink-tertiary)]">Keystrokes</div>
            <Table rows={KEY_ROWS} />
          </div>
        </div>
      </div>
    </div>
  );
}
