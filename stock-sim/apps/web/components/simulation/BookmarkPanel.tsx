"use client";

import * as React from "react";
import { useTimeControlStore } from "@/lib/stores/timeControlStore";
import type { Bookmark } from "@/lib/stores/timeControlStore";

const DOT_COLORS = [
  "var(--mer-accent-300)",
  "var(--positive)",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
];

function dotColor(index: number) {
  return DOT_COLORS[index % DOT_COLORS.length];
}

export function BookmarkPanel({ compact = false }: { compact?: boolean }) {
  const bookmarks = useTimeControlStore((s) => s.bookmarks);
  const goToTick = useTimeControlStore((s) => s.goToTick);
  const removeBookmark = useTimeControlStore((s) => s.removeBookmark);
  const updateBookmarkLabel = useTimeControlStore((s) => s.updateBookmarkLabel);
  const totalTicks = useTimeControlStore((s) => s.totalTicks);

  const [collapsed, setCollapsed] = React.useState(compact);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const editRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  function startEdit(bm: Bookmark) {
    setEditingId(bm.id);
    setEditValue(bm.label);
  }

  function commitEdit(id: string) {
    const trimmed = editValue.trim();
    if (trimmed) updateBookmarkLabel(id, trimmed);
    setEditingId(null);
  }

  return (
    <div
      style={{
        borderTop: "1px solid var(--mer-stroke-hairline)",
        background: "var(--mer-surface-1)",
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: compact ? "5px 14px" : "6px 16px",
          border: "none",
          background: "transparent",
          color: "var(--mer-ink-tertiary)",
          fontSize: "var(--fs-micro)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          style={{
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 150ms",
          }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        Bookmarks
        <span style={{ color: "var(--mer-ink-quaternary)" }}>({bookmarks.length})</span>
      </button>

      {!collapsed && (
        <div
          style={{
            maxHeight: compact ? 76 : 160,
            overflowY: "auto",
            padding: "0 16px 8px",
          }}
        >
          {bookmarks.length === 0 && (
            <div
              style={{
                fontSize: "var(--fs-micro)",
                color: "var(--mer-ink-quaternary)",
                padding: "4px 0",
              }}
            >
              No bookmarks yet.
            </div>
          )}

          {bookmarks.map((bm, i) => (
            <div
              key={bm.id}
              onDoubleClick={() => startEdit(bm)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 8px",
                borderRadius: "var(--mer-radius-sm)",
                cursor: "pointer",
                transition: "background 100ms",
              }}
              onClick={() => goToTick(bm.tick)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--mer-surface-2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: dotColor(i),
                  flexShrink: 0,
                }}
              />

              {editingId === bm.id ? (
                <input
                  ref={editRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(bm.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit(bm.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    height: 22,
                    padding: "0 6px",
                    border: "1px solid var(--mer-stroke-accent)",
                    borderRadius: "var(--mer-radius-sm)",
                    background: "var(--mer-surface-1)",
                    color: "var(--mer-ink-primary)",
                    fontSize: "var(--fs-micro)",
                    outline: "none",
                    minWidth: 0,
                  }}
                />
              ) : (
                <span
                  style={{
                    flex: 1,
                    fontSize: "var(--fs-micro)",
                    color: "var(--mer-ink-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {bm.label}
                </span>
              )}

              <span
                className="num"
                style={{
                  fontSize: "var(--fs-micro)",
                  color: "var(--mer-ink-quaternary)",
                  fontFamily: "var(--font-mono)",
                  flexShrink: 0,
                }}
              >
                {bm.tick.toLocaleString()}
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeBookmark(bm.id);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  border: "none",
                  background: "transparent",
                  color: "var(--mer-ink-quaternary)",
                  cursor: "pointer",
                  borderRadius: "var(--mer-radius-sm)",
                  flexShrink: 0,
                  fontSize: 12,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--mer-ink-primary)";
                  e.currentTarget.style.background = "var(--mer-surface-3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--mer-ink-quaternary)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
