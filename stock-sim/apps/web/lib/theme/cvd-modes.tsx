"use client";

import * as React from "react";

export type CvdMode = "normal" | "protanopia" | "deuteranopia" | "tritanopia";

export interface CvdPalette {
  mode: CvdMode;
  label: string;
  positive: string;
  negative: string;
  neutral: string;
}

export const CVD_PALETTES: Record<CvdMode, CvdPalette> = {
  normal: { mode: "normal", label: "Normal", positive: "#22c55e", negative: "#ef4444", neutral: "#6b7280" },
  protanopia: { mode: "protanopia", label: "Protanopia (red-blind)", positive: "#3b82f6", negative: "#f97316", neutral: "#6b7280" },
  deuteranopia: { mode: "deuteranopia", label: "Deuteranopia (green-blind)", positive: "#6366f1", negative: "#eab308", neutral: "#6b7280" },
  tritanopia: { mode: "tritanopia", label: "Tritanopia (blue-blind)", positive: "#22c55e", negative: "#ef4444", neutral: "#9ca3af" },
};

const STORAGE_KEY = "cvd-mode";

interface CvdContextValue {
  mode: CvdMode;
  palette: CvdPalette;
  setMode: (mode: CvdMode) => void;
}

const CvdContext = React.createContext<CvdContextValue | null>(null);

export function CvdProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<CvdMode>("normal");

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as CvdMode | null;
    if (stored && stored in CVD_PALETTES) setModeState(stored);
  }, []);

  const setMode = React.useCallback((next: CvdMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  React.useEffect(() => {
    const palette = CVD_PALETTES[mode];
    const root = document.documentElement;
    root.style.setProperty("--positive", palette.positive);
    root.style.setProperty("--negative", palette.negative);
    root.style.setProperty("--neutral", palette.neutral);
  }, [mode]);

  const value = React.useMemo(() => ({ mode, palette: CVD_PALETTES[mode], setMode }), [mode, setMode]);

  return <CvdContext.Provider value={value}>{children}</CvdContext.Provider>;
}

export function useCvdMode(): CvdContextValue {
  const ctx = React.useContext(CvdContext);
  if (!ctx) throw new Error("useCvdMode must be used within CvdProvider");
  return ctx;
}
