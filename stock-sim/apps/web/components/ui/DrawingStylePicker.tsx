"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { DrawingStyle } from "@/lib/charts/drawing/types";

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#a855f7",
  "#06b6d4",
  "#ffffff",
  "#6b7280",
];

const WIDTHS = [1, 2, 3, 4];
const STYLES: DrawingStyle["lineStyle"][] = ["solid", "dashed", "dotted"];

interface DrawingStylePickerProps {
  style: DrawingStyle;
  onChange: (style: DrawingStyle) => void;
  onApplyAll?: () => void;
  className?: string;
}

export function DrawingStylePicker({ style, onChange, onApplyAll, className }: DrawingStylePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-8 h-8 rounded bg-surface-secondary hover:bg-surface-tertiary transition-colors"
        title="Drawing Style"
      >
        <div
          className="w-4 h-0.5 rounded-full"
          style={{ backgroundColor: style.color, height: `${style.lineWidth}px` }}
        />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-48 bg-surface-primary border border-border-primary rounded-lg p-3 shadow-lg z-50">
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">Color</p>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onChange({ ...style, color: c })}
                  className={cn(
                    "w-5 h-5 rounded-full border transition-transform",
                    style.color === c ? "border-white scale-110" : "border-border-secondary hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">Width</p>
            <div className="flex gap-1.5">
              {WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => onChange({ ...style, lineWidth: w })}
                  className={cn(
                    "flex items-center justify-center w-8 h-6 rounded text-[11px] transition-colors",
                    style.lineWidth === w
                      ? "bg-accent-primary text-white"
                      : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                  )}
                >
                  {w}px
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">Style</p>
            <div className="flex gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ ...style, lineStyle: s })}
                  className={cn(
                    "flex items-center justify-center w-14 h-6 rounded text-[10px] capitalize transition-colors",
                    style.lineStyle === s
                      ? "bg-accent-primary text-white"
                      : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {onApplyAll && (
            <button
              onClick={() => {
                onApplyAll();
                setIsOpen(false);
              }}
              className="w-full py-1.5 text-[11px] bg-surface-secondary hover:bg-surface-tertiary rounded text-text-secondary transition-colors"
            >
              Apply to All
            </button>
          )}
        </div>
      )}
    </div>
  );
}
