"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface OverlayDef {
  id: string;
  name: string;
  category: "overlay" | "oscillator" | "volume" | "volatility";
  period?: number;
  color: string;
  defaultEnabled?: boolean;
}

export const OVERLAYS: OverlayDef[] = [
  { id: "sma20", name: "SMA", category: "overlay", period: 20, color: "#f59e0b" },
  { id: "sma50", name: "SMA", category: "overlay", period: 50, color: "#3b82f6" },
  { id: "ema12", name: "EMA", category: "overlay", period: 12, color: "#14b8a6" },
  { id: "ema26", name: "EMA", category: "overlay", period: 26, color: "#a855f7" },
  { id: "bbands", name: "Bollinger Bands", category: "overlay", period: 20, color: "#06b6d4" },
  { id: "vwap", name: "VWAP", category: "overlay", color: "#f97316" },
  { id: "ichimoku", name: "Ichimoku", category: "overlay", color: "#ec4899" },
  { id: "supertrend", name: "SuperTrend", category: "overlay", color: "#10b981" },
  { id: "keltner", name: "Keltner", category: "overlay", period: 20, color: "#8b5cf6" },
  { id: "donchian", name: "Donchian", category: "overlay", period: 20, color: "#f43f5e" },

  { id: "rsi", name: "RSI", category: "oscillator", period: 14, color: "#a78bfa" },
  { id: "macd", name: "MACD", category: "oscillator", color: "#60a5fa" },
  { id: "stoch", name: "Stochastic", category: "oscillator", period: 14, color: "#fb923c" },
  { id: "adx", name: "ADX", category: "oscillator", period: 14, color: "#34d399" },
  { id: "cci", name: "CCI", category: "oscillator", period: 20, color: "#f472b6" },
  { id: "williams", name: "Williams %R", category: "oscillator", period: 14, color: "#c084fc" },
  { id: "mfi", name: "MFI", category: "oscillator", period: 14, color: "#fbbf24" },
  { id: "roc", name: "ROC", category: "oscillator", period: 12, color: "#2dd4bf" },

  { id: "obv", name: "OBV", category: "volume", color: "#60a5fa" },
  { id: "cmf", name: "CMF", category: "volume", period: 20, color: "#a78bfa" },
  { id: "vp", name: "Volume Profile", category: "volume", color: "#3b82f6" },

  { id: "atr", name: "ATR", category: "volatility", period: 14, color: "#fb923c" },
];

const CATEGORY_LABELS: Record<string, string> = {
  overlay: "Overlay",
  oscillator: "Oscillator",
  volume: "Volume",
  volatility: "Volatility",
};

const CATEGORY_ORDER = ["overlay", "oscillator", "volume", "volatility"] as const;

export interface OverlayPickerProps {
  activeIds: string[];
  onToggle: (id: string) => void;
  onClearAll: () => void;
}

export function OverlayPicker({ activeIds, onToggle, onClearAll }: OverlayPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const ref = React.useRef<HTMLDivElement>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    if (!search) return OVERLAYS;
    const q = search.toLowerCase();
    return OVERLAYS.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.period && `${o.name} ${o.period}`.toLowerCase().includes(q))
    );
  }, [search]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, OverlayDef[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const o of filtered) map.get(o.category)?.push(o);
    return map;
  }, [filtered]);

  const activeOverlays = React.useMemo(() => OVERLAYS.filter((o) => activeIds.includes(o.id)), [activeIds]);

  function toggle(cat: string) {
    setCollapsed((p) => ({ ...p, [cat]: !p[cat] }));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-7 rounded-sm px-2.5 text-micro font-medium transition-colors inline-flex items-center gap-1.5",
          activeIds.length > 0
            ? "bg-accent-dim text-accent"
            : "text-text-tertiary hover:bg-bg-hover hover:text-text-secondary"
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M1 9L4 4L7 6L11 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Indicators</span>
        {activeIds.length > 0 && (
          <span className="ml-0.5 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-bg-primary leading-4">
            {activeIds.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-sm border border-border bg-bg-secondary shadow-mer-overlay">
          <div className="border-b border-border px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search indicators..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-full rounded-sm border border-border bg-bg-primary px-2.5 text-body text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-dim"
            />
          </div>

          {activeOverlays.length > 0 && !search && (
            <div className="border-b border-border px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-micro font-medium text-text-tertiary">Active ({activeOverlays.length})</span>
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-micro text-negative hover:text-negative/80 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {activeOverlays.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => onToggle(o.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-tertiary px-2 py-0.5 text-micro text-text-secondary hover:bg-bg-hover transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: o.color }} />
                    {o.name}
                    {o.period ? ` (${o.period})` : ""}
                    <svg width="8" height="8" viewBox="0 0 8 8" className="text-text-tertiary">
                      <path d="M2 2L6 6M6 2L2 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto p-1">
            {Array.from(grouped.entries()).map(([cat, items]) => {
              if (items.length === 0) return null;
              const isCollapsed = collapsed[cat];
              return (
                <div key={cat}>
                  <button
                    type="button"
                    onClick={() => toggle(cat)}
                    className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-micro font-medium text-text-tertiary hover:bg-bg-hover transition-colors"
                  >
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 8 8"
                      fill="none"
                      className={cn("transition-transform", isCollapsed ? "" : "rotate-90")}
                    >
                      <path d="M2 1L6 4L2 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {CATEGORY_LABELS[cat]}
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {items.map((o) => {
                        const isEnabled = activeIds.includes(o.id);
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => onToggle(o.id)}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-body transition-colors",
                              isEnabled ? "bg-accent-dim/50 text-text-primary" : "text-text-secondary hover:bg-bg-hover"
                            )}
                          >
                            <div
                              className={cn(
                                "h-3.5 w-6 rounded-full transition-colors relative",
                                isEnabled ? "bg-accent" : "bg-bg-tertiary"
                              )}
                            >
                              <div
                                className={cn(
                                  "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform",
                                  isEnabled ? "translate-x-3" : "translate-x-0.5"
                                )}
                              />
                            </div>
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />
                            <span className="flex-1 truncate">
                              {o.name}
                              {o.period ? ` (${o.period})` : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
