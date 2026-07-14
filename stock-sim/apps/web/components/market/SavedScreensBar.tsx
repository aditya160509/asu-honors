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
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3 py-1.5" role="tablist" aria-label="Saved screens">
      {screens.map((screen) => {
        const active = screen.id === activeId;
        return (
          <div
            key={screen.id}
            role="tab"
            aria-selected={active}
            className={cn(
              "group relative flex shrink-0 cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-small transition-colors",
              active ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
            )}
            onClick={() => onSelect(screen.id)}
          >
            {screen.name}
            {!screen.builtin && (
              <button
                type="button"
                aria-label={`Remove ${screen.name} screen`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(screen.id);
                }}
                className="text-text-tertiary opacity-0 hover:text-negative group-hover:opacity-100"
              >
                <X size={11} />
              </button>
            )}
            {active && <span className="absolute inset-x-2 -bottom-[7px] h-px bg-accent" />}
          </div>
        );
      })}
    </div>
  );
}
