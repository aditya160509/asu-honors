"use client";

import * as React from "react";

/** Basic command palette open state + global trigger shortcuts (reduced scope — see SKILL.md section 17). */
export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && (e.key === "`" || e.key.toLowerCase() === "f")) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
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

  return { open, setOpen };
}
