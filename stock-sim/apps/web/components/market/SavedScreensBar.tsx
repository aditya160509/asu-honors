"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedScreen } from "@/lib/market/types";

export interface SavedScreensBarProps {
  screens: SavedScreen[];
  activeId: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function SavedScreensBar({ screens, activeId, onSelect, onRemove }: SavedScreensBarProps) {
  return (
    <div
      className="flex items-center gap-0.5 overflow-x-auto border-b border-border/60 px-2 py-1 scrollbar-none"
      role="tablist"
      aria-label="Saved screens"
    >
      {screens.map((screen) => {
        const active = screen.id === activeId;
        return (
          <div
            key={screen.id}
            role="tab"
            aria-selected={active}
            className={cn(
              "group relative flex shrink-0 cursor-pointer items-center gap-1 px-2 py-1 text-micro font-medium transition-all rounded-sm",
              active
                ? "bg-accent/10 text-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            )}
            onClick={() => onSelect(screen.id)}
          >
            <span className="whitespace-nowrap">{screen.name}</span>
            {!screen.builtin && (
              <button
                type="button"
                aria-label={`Remove ${screen.name} screen`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(screen.id);
                }}
                className="text-text-tertiary opacity-0 hover:text-negative group-hover:opacity-100 ml-0.5"
              >
                <X size={10} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
