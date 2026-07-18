"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ChartType } from "@/lib/charts/types";
import { CHART_TYPES } from "@/lib/charts/types";

export interface ChartTypePickerProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

export function ChartTypePicker({ value, onChange }: ChartTypePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [focusIdx, setFocusIdx] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const types = Object.keys(CHART_TYPES) as ChartType[];

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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setFocusIdx(types.indexOf(value));
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => (i + 1) % types.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => (i - 1 + types.length) % types.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onChange(types[focusIdx]);
      setOpen(false);
      btnRef.current?.focus();
    }
  }

  const current = CHART_TYPES[value];

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-7 rounded-md border border-border bg-bg-secondary px-2.5 text-micro font-semibold transition-colors inline-flex items-center gap-1.5",
          "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-[10px] font-bold text-accent">{current.icon}</span>
        <span>{current.label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-text-tertiary">
          <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute top-full left-0 z-50 mt-1 w-64 rounded-lg border border-border bg-bg-secondary p-1.5 shadow-mer-overlay"
          role="listbox"
          onKeyDown={handleKeyDown}
        >
          <div className="grid grid-cols-1 gap-0.5">
            {types.map((type, idx) => {
              const cfg = CHART_TYPES[type];
              const isSelected = type === value;
              const isFocused = idx === focusIdx;
              return (
                <button
                  key={type}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(type);
                    setOpen(false);
                    btnRef.current?.focus();
                  }}
                  onMouseEnter={() => setFocusIdx(idx)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-micro transition-colors",
                    isSelected && "bg-accent-dim text-accent",
                    isFocused && !isSelected && "bg-bg-hover",
                    !isSelected && !isFocused && "text-text-secondary hover:bg-bg-hover"
                  )}
                >
                  <span className="flex h-6 w-8 items-center justify-center rounded border border-border bg-bg-primary text-[10px] font-bold text-accent">
                    {cfg.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{cfg.label}</span>
                    <span className="block truncate text-text-tertiary">{cfg.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
