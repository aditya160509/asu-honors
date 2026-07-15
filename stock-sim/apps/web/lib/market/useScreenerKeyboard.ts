"use client";

import * as React from "react";

export interface UseScreenerKeyboardOptions {
  focusedIndex: number;
  setFocusedIndex: (n: number) => void;
  totalRows: number;
  onActivateRow: (ticker: string) => void;
  onToggleSelect: (ticker: string) => void;
  onToggleWatch: (ticker: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSelectPreset?: (index: number) => void;
  rowGetter?: (index: number) => { ticker: string } | null;
  onEsc?: () => void;
}

export function useScreenerKeyboard({
  focusedIndex,
  setFocusedIndex,
  totalRows,
  onActivateRow,
  onToggleSelect,
  onToggleWatch,
  searchInputRef,
  onSelectPreset,
  rowGetter,
  onEsc,
}: UseScreenerKeyboardOptions) {
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (e.key === "/" || (e.ctrlKey && e.key === "k")) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        if (isInput) {
          (target as HTMLInputElement).blur();
        }
        onEsc?.();
        return;
      }

      if (isInput) return;

      switch (e.key) {
        case "j":
        case "ArrowDown": {
          e.preventDefault();
          setFocusedIndex(Math.min(focusedIndex + 1, totalRows - 1));
          break;
        }
        case "k":
        case "ArrowUp": {
          e.preventDefault();
          setFocusedIndex(Math.max(focusedIndex - 1, 0));
          break;
        }
        case "Enter": {
          e.preventDefault();
          const row = rowGetter?.(focusedIndex);
          if (row) onActivateRow(row.ticker);
          break;
        }
        case "c": {
          e.preventDefault();
          const row = rowGetter?.(focusedIndex);
          if (row) onToggleSelect(row.ticker);
          break;
        }
        case "w": {
          e.preventDefault();
          const row = rowGetter?.(focusedIndex);
          if (row) onToggleWatch(row.ticker);
          break;
        }
        default: {
          const num = parseInt(e.key, 10);
          if (num >= 1 && num <= 9 && onSelectPreset) {
            e.preventDefault();
            onSelectPreset(num - 1);
          }
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedIndex, setFocusedIndex, totalRows, onActivateRow, onToggleSelect, onToggleWatch, searchInputRef, onSelectPreset, rowGetter, onEsc]);
}
