"use client";

import * as React from "react";
import type { IndicatorType, IndicatorKind } from "@/lib/charts/indicators";
import { INDICATOR_REGISTRY } from "@/lib/charts/indicators";

interface IndicatorPickerProps {
  activeIndicators: IndicatorType[];
  onToggle: (type: IndicatorType) => void;
}

interface GroupedIndicators {
  category: string;
  items: { type: IndicatorType; config: (typeof INDICATOR_REGISTRY)[IndicatorType] }[];
}

function groupIndicators(): GroupedIndicators[] {
  const groups = new Map<string, GroupedIndicators>();

  for (const [key, config] of Object.entries(INDICATOR_REGISTRY)) {
    const type = key as IndicatorType;
    const cat = config.category;
    if (!groups.has(cat)) {
      groups.set(cat, { category: cat, items: [] });
    }
    groups.get(cat)!.items.push({ type, config });
  }

  return Array.from(groups.values());
}

function KindBadge({ kind }: { kind: IndicatorKind }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-micro ${
        kind === "overlay"
          ? "bg-bg-hover text-text-secondary"
          : "bg-accent-dim text-accent"
      }`}
    >
      {kind === "overlay" ? "Overlay" : "Panel"}
    </span>
  );
}

export function IndicatorPicker({ activeIndicators, onToggle }: IndicatorPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const groups = React.useMemo(() => groupIndicators(), []);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            item.config.label.toLowerCase().includes(q) ||
            item.type.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, search]);

  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-secondary px-3 py-1.5 text-body text-text-primary transition-colors hover:bg-bg-hover focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <svg className="h-4 w-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Indicators
        {activeIndicators.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-micro font-medium text-white">
            {activeIndicators.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-bg-secondary shadow-xl">
          <div className="border-b border-border px-3 py-2">
            <input
              type="text"
              placeholder="Search indicators..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-body text-text-primary placeholder:text-text-tertiary outline-none"
              autoFocus
            />
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {filtered.map((group) => (
              <div key={group.category}>
                <div className="px-3 py-1.5 text-micro font-medium text-text-tertiary uppercase tracking-wider">
                  {group.category}
                </div>
                {group.items.map(({ type, config }) => {
                  const active = activeIndicators.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onToggle(type)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-bg-hover"
                    >
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                          active
                            ? "border-accent bg-accent text-white"
                            : "border-border-light bg-transparent"
                        }`}
                      >
                        {active && (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-body text-text-primary">{config.label}</span>
                          <KindBadge kind={config.type} />
                        </div>
                      </div>

                      <div className="flex gap-1">
                        {config.colors.slice(0, 3).map((color, i) => (
                          <div
                            key={i}
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-body text-text-tertiary">
                No indicators match &quot;{search}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
