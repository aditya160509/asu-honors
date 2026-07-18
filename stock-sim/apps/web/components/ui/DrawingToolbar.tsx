"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DrawingStylePicker } from "./DrawingStylePicker";
import type { DrawingManager } from "@/lib/charts/drawing/DrawingManager";
import type { DrawingToolType, DrawingStyle } from "@/lib/charts/drawing/types";
import { DEFAULT_DRAWING_STYLE } from "@/lib/charts/drawing/types";

interface ToolConfig {
  type: DrawingToolType | null;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  group?: string;
}

const TOOLS: ToolConfig[] = [
  {
    type: null,
    label: "Crosshair",
    shortcut: "1",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="8" y1="2" x2="8" y2="14" />
        <line x1="2" y1="8" x2="14" y2="8" />
      </svg>
    ),
  },
  {
    type: "trendline",
    label: "Trendline",
    shortcut: "2",
    group: "line",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="2" y1="12" x2="14" y2="4" />
      </svg>
    ),
  },
  {
    type: "horizontalLine",
    label: "Horizontal Line",
    shortcut: "3",
    group: "line",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2">
        <line x1="2" y1="8" x2="14" y2="8" />
      </svg>
    ),
  },
  {
    type: "verticalLine",
    label: "Vertical Line",
    shortcut: "4",
    group: "line",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2">
        <line x1="8" y1="2" x2="8" y2="14" />
      </svg>
    ),
  },
  {
    type: "fibonacciRetracement",
    label: "Fibonacci Retracement",
    shortcut: "5",
    group: "fib",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="2" y1="3" x2="14" y2="3" />
        <line x1="2" y1="6" x2="14" y2="6" />
        <line x1="2" y1="8" x2="14" y2="8" />
        <line x1="2" y1="10.5" x2="14" y2="10.5" />
        <line x1="2" y1="13" x2="14" y2="13" />
      </svg>
    ),
  },
  {
    type: "fibonacciExtension",
    label: "Fibonacci Extension",
    shortcut: "6",
    group: "fib",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="2" y1="3" x2="14" y2="3" />
        <line x1="2" y1="6" x2="14" y2="6" />
        <line x1="2" y1="8" x2="14" y2="8" />
        <line x1="2" y1="10" x2="14" y2="10" />
        <line x1="2" y1="13" x2="14" y2="13" />
        <polyline points="10,3 12,5 14,3" />
      </svg>
    ),
  },
  {
    type: "parallelChannel",
    label: "Parallel Channel",
    shortcut: "7",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="2" y1="12" x2="14" y2="6" />
        <line x1="2" y1="4" x2="14" y2="-2" />
      </svg>
    ),
  },
  {
    type: "rectangle",
    label: "Rectangle",
    shortcut: "8",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="12" height="8" rx="1" />
      </svg>
    ),
  },
  {
    type: "ellipse",
    label: "Ellipse",
    shortcut: "9",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <ellipse cx="8" cy="8" rx="6" ry="4" />
      </svg>
    ),
  },
  {
    type: "arrow",
    label: "Arrow",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="3" y1="13" x2="13" y2="3" />
        <polyline points="8,3 13,3 13,8" />
      </svg>
    ),
  },
  {
    type: "text",
    label: "Text",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <text x="4" y="13" fontSize="13" fontWeight="bold" fontFamily="monospace">T</text>
      </svg>
    ),
  },
  {
    type: "measure",
    label: "Measure",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="2" y1="14" x2="14" y2="2" />
        <line x1="2" y1="14" x2="2" y2="10" />
        <line x1="2" y1="14" x2="6" y2="14" />
        <line x1="14" y1="2" x2="14" y2="6" />
        <line x1="14" y1="2" x2="10" y2="2" />
      </svg>
    ),
  },
];

interface DrawingToolbarProps {
  manager: DrawingManager;
  className?: string;
}

export function DrawingToolbar({ manager, className }: DrawingToolbarProps) {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
  const [drawingStyle, setDrawingStyle] = React.useState<DrawingStyle>({ ...DEFAULT_DRAWING_STYLE });
  const [submenu, setSubmenu] = React.useState<string | null>(null);

  React.useEffect(() => {
    return manager.subscribe(() => forceUpdate());
  }, [manager]);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        manager.setActiveTool(null);
        manager.selectDrawing(null);
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (manager.selectedId) {
          manager.removeDrawing(manager.selectedId);
        }
        return;
      }

      const tool = TOOLS.find((t) => t.shortcut === e.key);
      if (tool) {
        e.preventDefault();
        if (manager.activeTool === tool.type) {
          manager.setActiveTool(null);
        } else {
          manager.setActiveTool(tool.type);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [manager]);

  function handleToolClick(tool: ToolConfig) {
    if (manager.activeTool === tool.type) {
      manager.setActiveTool(null);
    } else {
      manager.setActiveTool(tool.type);
    }
    setSubmenu(null);
  }

  const activeTool = manager.activeTool;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "absolute left-2 top-2 z-10 flex flex-col items-center gap-0.5 bg-surface-primary border border-border-primary rounded-lg p-1 shadow-lg",
          className
        )}
      >
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.type;
          return (
            <Tooltip key={tool.label}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleToolClick(tool)}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded transition-colors",
                    isActive
                      ? "bg-accent-primary text-white"
                      : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                  )}
                >
                  {tool.icon}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <span>{tool.label}</span>
                {tool.shortcut && (
                  <span className="ml-2 text-text-tertiary">{tool.shortcut}</span>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}

        <div className="w-6 h-px bg-border-primary my-1" />

        <DrawingStylePicker
          style={drawingStyle}
          onChange={(s) => {
            setDrawingStyle(s);
            if (manager.selectedId) {
              manager.updateDrawing(manager.selectedId, { style: s });
            }
          }}
          onApplyAll={() => {
            for (const d of manager.getDrawings()) {
              manager.updateDrawing(d.id, { style: drawingStyle });
            }
          }}
        />

        {manager.selectedId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => manager.removeDrawing(manager.selectedId!)}
                className="flex items-center justify-center w-8 h-8 rounded text-negative hover:bg-surface-secondary transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Delete</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => manager.clear()}
              className="flex items-center justify-center w-8 h-8 rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-secondary transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="10" height="10" rx="1" />
                <line x1="6" y1="6" x2="10" y2="10" />
                <line x1="10" y1="6" x2="6" y2="10" />
              </svg>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Clear All</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
