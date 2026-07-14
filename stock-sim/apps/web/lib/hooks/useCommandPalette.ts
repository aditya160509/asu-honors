"use client";

import * as React from "react";
import { createSharedToggle } from "./createSharedToggle";

const commandPaletteToggle = createSharedToggle();

/** Call from anywhere (Sidebar quick actions, Header search trigger) to open the palette. */
export const openCommandPalette = commandPaletteToggle.open;

/** Basic command palette open state + global trigger shortcuts (reduced scope — see SKILL.md section 17). */
export function useCommandPalette() {
  const open = commandPaletteToggle.useValue();

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && (e.key === "`" || e.key.toLowerCase() === "f")) {
        e.preventDefault();
        commandPaletteToggle.set(!commandPaletteToggle.get());
        return;
      }
      if (e.key === "Escape") {
        commandPaletteToggle.close();
      }
      if (e.key === "/" && !isEditable) {
        const searchInput = document.querySelector<HTMLInputElement>('input[aria-label*="earch" i]');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { open, setOpen: commandPaletteToggle.set };
}
