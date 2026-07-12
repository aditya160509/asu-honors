"use client";

import { Check, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CVD_PALETTES, useCvdMode, type CvdMode } from "@/lib/theme/cvd-modes";

const MODES: CvdMode[] = ["normal", "protanopia", "deuteranopia", "tritanopia"];

/** Preferences control for the 4 CVD color modes (SKILL.md section 18) — live swatch preview per mode. */
export function CvdModeSelector() {
  const { mode, setMode } = useCvdMode();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none flex items-center justify-center h-8 w-8 rounded-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary" aria-label="Color accessibility mode">
        <Eye size={15} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {MODES.map((m) => {
          const palette = CVD_PALETTES[m];
          return (
            <DropdownMenuItem key={m} onClick={() => setMode(m)} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                {mode === m ? <Check size={13} className="text-accent" /> : <span className="w-[13px]" />}
                <span className="text-small">{palette.label}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: palette.positive }} />
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: palette.negative }} />
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
