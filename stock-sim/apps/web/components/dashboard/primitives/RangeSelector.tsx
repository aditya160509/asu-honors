"use client";

import { cn } from "@/lib/utils";

export interface RangeOption<T extends string> {
  value: T;
  label: string;
}

export interface RangeSelectorProps<T extends string> {
  options: RangeOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Ghost-pill segmented control — DESIGN_SPEC's chart range-selector grammar, generic enough to
 * double as any small view/mode switcher (e.g. an allocation chart's Treemap/Donut/Bars toggle). */
export function RangeSelector<T extends string>({ options, value, onChange, className }: RangeSelectorProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-mer-sm border border-[color:var(--mer-stroke-hairline)] bg-mer-surface-3 p-0.5",
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            "rounded-mer-xs px-2 py-1 text-micro font-medium uppercase transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--mer-accent-500)] focus-visible:outline-offset-1",
            value === opt.value ? "bg-mer-accent-500 text-white" : "text-mer-ink-tertiary hover:text-mer-ink-primary"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
