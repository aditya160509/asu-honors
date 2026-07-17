"use client";

import * as React from "react";
import { X } from "lucide-react";
import { RangeSlider } from "@/components/market/RangeSlider";
import { CAP_ALIASES, upsertTokensOfKey } from "@/lib/market/commandGrammar";
import { sectorCode, sectorToken } from "@/lib/market/sectorAbbrev";
import { cn } from "@/lib/utils";
import type { FilterBounds } from "@/lib/market/filters";
import type { EnrichedCompany, MarketFilterState } from "@/lib/market/types";

export interface FilterOverlayProps {
  open: boolean;
  onClose: () => void;
  industries: string[];
  companies: EnrichedCompany[];
  bounds: FilterBounds;
  filters: MarketFilterState;
  commandText: string;
  onCommandTextChange: (next: string) => void;
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--term-hairline)] px-4 py-3">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]">{label}</div>
      {children}
    </div>
  );
}

/** Visual editor FOR the command line, not a separate filter mechanism — every
 * control here reads/writes the same commandText the CommandLine input shows,
 * so there's never a second, out-of-sync filter state. */
export function FilterOverlay({
  open,
  onClose,
  industries,
  companies,
  bounds,
  filters,
  commandText,
  onCommandTextChange,
}: FilterOverlayProps) {
  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  const industryCounts = new Map<string, number>();
  for (const c of companies) industryCounts.set(c.industry_name, (industryCounts.get(c.industry_name) ?? 0) + 1);

  function toggleCap(cat: string) {
    const has = filters.marketCapCategory.map((c) => c.toLowerCase()).includes(cat);
    const next = has
      ? filters.marketCapCategory.filter((c) => c.toLowerCase() !== cat)
      : [...filters.marketCapCategory, cat];
    onCommandTextChange(
      upsertTokensOfKey(commandText, "cap", next.length > 0 ? [`cap:${next.map((c) => c.toLowerCase()).join(",")}`] : [])
    );
  }

  function toggleSector(name: string) {
    const has = filters.industries.includes(name);
    const next = has ? filters.industries.filter((i) => i !== name) : [...filters.industries, name];
    onCommandTextChange(upsertTokensOfKey(commandText, "sector", next.map((i) => `sector:${sectorToken(i)}`)));
  }

  function setRange(key: "chg" | "price" | "ivgap" | "vol", min: number, max: number, bMin: number, bMax: number) {
    const tokens: string[] = [];
    if (min > bMin) tokens.push(`${key}>${Number(min.toFixed(2))}`);
    if (max < bMax) tokens.push(`${key}<${Number(max.toFixed(2))}`);
    onCommandTextChange(upsertTokensOfKey(commandText, key, tokens));
  }

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-label="Filter overlay"
      className="absolute left-0 top-0 z-40 flex h-full w-[320px] flex-col border-r border-[var(--term-hairline)] bg-[var(--term-bg)] shadow-[0_8px_24px_rgba(4,6,10,0.5)]"
    >
      <div className="flex items-center justify-between border-b border-[var(--term-divider)] px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]">Filters</span>
        <button type="button" onClick={onClose} aria-label="Close filter overlay" className="text-[var(--term-ink-tertiary)] hover:text-[var(--term-ink)]">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Group label="Cap">
          <div className="flex flex-wrap gap-2">
            {CAP_ALIASES.map((cat) => {
              const active = filters.marketCapCategory.map((c) => c.toLowerCase()).includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCap(cat)}
                  className={cn(
                    "font-mono text-[13px] uppercase",
                    active ? "text-[var(--term-accent)]" : "text-[var(--term-ink-secondary)] hover:text-[var(--term-ink)]"
                  )}
                >
                  [{active ? "x" : " "}] {cat}
                </button>
              );
            })}
          </div>
        </Group>

        <Group label={`Sector (${industries.length})`}>
          <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
            {industries.map((name) => {
              const active = filters.industries.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleSector(name)}
                  className={cn(
                    "flex items-center justify-between font-mono text-[13px]",
                    active ? "text-[var(--term-accent)]" : "text-[var(--term-ink-secondary)] hover:text-[var(--term-ink)]"
                  )}
                >
                  <span className="truncate text-left">
                    [{active ? "x" : " "}] {sectorCode(name)}
                  </span>
                  <span className="tabular-nums text-[var(--term-ink-tertiary)]">{industryCounts.get(name) ?? 0}</span>
                </button>
              );
            })}
          </div>
        </Group>

        <Group label="Day Chg %">
          <RangeSlider
            bounds={bounds.dayChangePct}
            value={filters.dayChangePct ?? bounds.dayChangePct}
            onChange={(v) => setRange("chg", v.min, v.max, bounds.dayChangePct.min, bounds.dayChangePct.max)}
            formatValue={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`}
          />
        </Group>

        <Group label="Price">
          <RangeSlider
            bounds={bounds.price}
            value={filters.price ?? bounds.price}
            onChange={(v) => setRange("price", v.min, v.max, bounds.price.min, bounds.price.max)}
            formatValue={(n) => `$${n.toFixed(2)}`}
          />
        </Group>

        <Group label="IV Gap %">
          <RangeSlider
            bounds={bounds.ivGapPct}
            value={filters.ivGapPct ?? bounds.ivGapPct}
            onChange={(v) => setRange("ivgap", v.min, v.max, bounds.ivGapPct.min, bounds.ivGapPct.max)}
            formatValue={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`}
          />
        </Group>

        <Group label="Volume">
          <RangeSlider
            bounds={bounds.volume}
            value={filters.volume ?? bounds.volume}
            onChange={(v) => setRange("vol", v.min, v.max, bounds.volume.min, bounds.volume.max)}
            formatValue={(n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : n.toFixed(0))}
          />
        </Group>
      </div>

      <div className="border-t border-[var(--term-divider)] px-4 py-2 font-mono text-[11px] text-[var(--term-ink-tertiary)]">
        ESC to close · edits write into the command line
      </div>
    </div>
  );
}
