"use client";

import { ArrowDown, ArrowUp, Check, Columns3, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnDef, ColumnKey } from "@/lib/market/types";

export interface ColumnManagerProps {
  columns: ColumnDef[];
  order: ColumnKey[];
  hidden: ColumnKey[];
  onToggle: (key: ColumnKey) => void;
  onMove: (key: ColumnKey, direction: -1 | 1) => void;
  onReset: () => void;
}

export function ColumnManager({ columns, order, hidden, onToggle, onMove, onReset }: ColumnManagerProps) {
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const ordered = order.map((k) => byKey.get(k)).filter((c): c is ColumnDef => Boolean(c));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5" aria-label="Manage columns">
          <Columns3 size={14} />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1 text-micro uppercase tracking-wide text-text-tertiary">Visible columns</div>
        {ordered.map((col, i) => {
          const isHidden = hidden.includes(col.key);
          return (
            <DropdownMenuItem
              key={col.key}
              onSelect={(e) => {
                e.preventDefault();
                onToggle(col.key);
              }}
              className="justify-between"
            >
              <span className="flex items-center gap-2">
                <span className={isHidden ? "text-text-tertiary" : "text-accent"}>
                  {isHidden ? <span className="inline-block w-3" /> : <Check size={13} />}
                </span>
                <span className={isHidden ? "text-text-tertiary" : "text-text-primary"}>{col.header}</span>
              </span>
              <span className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label={`Move ${col.header} left`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(col.key, -1);
                  }}
                  disabled={i === 0}
                  className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30"
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${col.header} right`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(col.key, 1);
                  }}
                  disabled={i === ordered.length - 1}
                  className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30"
                >
                  <ArrowDown size={11} />
                </button>
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onReset} className="gap-1.5 text-text-secondary">
          <RotateCcw size={13} />
          Reset to default
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
