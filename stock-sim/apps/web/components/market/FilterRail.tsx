"use client";

import * as React from "react";
import { ChevronDown, ChevronsLeft, ChevronsRight, RotateCcw, Save } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RangeSlider } from "@/components/market/RangeSlider";
import { activeFilterGroupCount, emptyFilterState } from "@/lib/market/filters";
import type { FilterBounds } from "@/lib/market/filters";
import type { MarketFilterState } from "@/lib/market/types";

export interface FilterRailProps {
  industries: string[];
  bounds: FilterBounds;
  filters: MarketFilterState;
  onChange: (next: MarketFilterState) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSave: () => void;
}

function FilterSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="border-b border-border py-3 first:pt-0 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left group"
      >
        <span className="flex items-center gap-2">
          <span className="text-micro font-medium uppercase text-text-secondary group-hover:text-text-primary transition-colors">
            {title}
          </span>
          {count > 0 && (
            <Badge variant="accent" className="h-4 min-w-4 justify-center px-1">
              {count}
            </Badge>
          )}
        </span>
        <ChevronDown
          size={13}
          className={cn("text-text-tertiary transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function FilterRail({
  industries,
  bounds,
  filters,
  onChange,
  collapsed,
  onToggleCollapsed,
  onSave,
}: FilterRailProps) {
  const activeCount = activeFilterGroupCount(filters, bounds);

  if (collapsed) {
    return (
      <div className="flex w-11 shrink-0 flex-col items-center gap-3 border-r border-border pt-1">
        <Button variant="ghost" size="icon" onClick={onToggleCollapsed} aria-label="Expand filters">
          <ChevronsRight size={15} />
        </Button>
        {activeCount > 0 && (
          <Badge variant="accent" className="h-4 min-w-4 justify-center px-1">
            {activeCount}
          </Badge>
        )}
      </div>
    );
  }

  function toggleIndustry(name: string) {
    const has = filters.industries.includes(name);
    onChange({
      ...filters,
      industries: has ? filters.industries.filter((i) => i !== name) : [...filters.industries, name],
    });
  }

  return (
    <div className="flex w-[280px] shrink-0 flex-col border-r border-border">
      <div className="flex items-center justify-between px-3 pt-1 pb-2">
        <span className="text-micro font-medium uppercase text-text-secondary">Filters</span>
        <Button variant="ghost" size="icon" onClick={onToggleCollapsed} aria-label="Collapse filters">
          <ChevronsLeft size={15} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <FilterSection title="Industry" count={filters.industries.length}>
          <div className="flex flex-wrap gap-1.5">
            {industries.map((name) => (
              <Chip
                key={name}
                variant={filters.industries.includes(name) ? "selected" : "default"}
                onClick={() => toggleIndustry(name)}
                className="h-6 px-2 text-micro"
              >
                {name}
              </Chip>
            ))}
          </div>
        </FilterSection>

        <FilterSection
          title="Market Cap"
          count={
            filters.marketCap && (filters.marketCap.min > bounds.marketCap.min || filters.marketCap.max < bounds.marketCap.max)
              ? 1
              : 0
          }
        >
          <RangeSlider
            bounds={bounds.marketCap}
            value={filters.marketCap ?? bounds.marketCap}
            onChange={(v) => onChange({ ...filters, marketCap: v })}
            formatValue={(n) => (n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${n.toFixed(0)}`)}
          />
        </FilterSection>

        <FilterSection
          title="Price"
          count={filters.price && (filters.price.min > bounds.price.min || filters.price.max < bounds.price.max) ? 1 : 0}
        >
          <RangeSlider
            bounds={bounds.price}
            value={filters.price ?? bounds.price}
            onChange={(v) => onChange({ ...filters, price: v })}
            formatValue={(n) => `$${n.toFixed(2)}`}
          />
        </FilterSection>

        <FilterSection
          title="Day Change %"
          count={
            filters.dayChangePct &&
            (filters.dayChangePct.min > bounds.dayChangePct.min || filters.dayChangePct.max < bounds.dayChangePct.max)
              ? 1
              : 0
          }
        >
          <RangeSlider
            bounds={bounds.dayChangePct}
            value={filters.dayChangePct ?? bounds.dayChangePct}
            onChange={(v) => onChange({ ...filters, dayChangePct: v })}
            formatValue={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`}
          />
        </FilterSection>

        <FilterSection
          title="Volatility"
          count={
            filters.volatility && (filters.volatility.min > bounds.volatility.min || filters.volatility.max < bounds.volatility.max)
              ? 1
              : 0
          }
        >
          <RangeSlider
            bounds={bounds.volatility}
            value={filters.volatility ?? bounds.volatility}
            onChange={(v) => onChange({ ...filters, volatility: v })}
            formatValue={(n) => n.toFixed(2)}
          />
        </FilterSection>

        <FilterSection
          title="Valuation (IV Gap %)"
          count={
            filters.ivGapPct && (filters.ivGapPct.min > bounds.ivGapPct.min || filters.ivGapPct.max < bounds.ivGapPct.max)
              ? 1
              : 0
          }
        >
          <RangeSlider
            bounds={bounds.ivGapPct}
            value={filters.ivGapPct ?? bounds.ivGapPct}
            onChange={(v) => onChange({ ...filters, ivGapPct: v })}
            formatValue={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`}
          />
        </FilterSection>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => onChange(emptyFilterState())}
          disabled={activeCount === 0}
        >
          <RotateCcw size={13} />
          Reset
        </Button>
        <Button variant="secondary" size="sm" className="flex-1 gap-1.5" onClick={onSave} disabled={activeCount === 0}>
          <Save size={13} />
          Save
        </Button>
      </div>
    </div>
  );
}
