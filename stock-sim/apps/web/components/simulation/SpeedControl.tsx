"use client";

import * as React from "react";
import { useTimeControlStore } from "@/lib/stores/timeControlStore";
import type { PlaybackSpeed } from "@/lib/stores/timeControlStore";

const SPEED_OPTIONS: PlaybackSpeed[] = [1, 5, 10, 25, 100];

const SPEED_KEY_MAP: Record<string, PlaybackSpeed> = {
  "1": 1,
  "2": 5,
  "3": 10,
  "4": 25,
  "5": 100,
};

export function SpeedControl() {
  const speed = useTimeControlStore((s) => s.speed);
  const setSpeed = useTimeControlStore((s) => s.setSpeed);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const mapped = SPEED_KEY_MAP[e.key];
      if (mapped != null) {
        e.preventDefault();
        setSpeed(mapped);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSpeed]);

  return (
    <div style={{ display: "flex" }}>
      {SPEED_OPTIONS.map((s, i) => {
        const active = s === speed;
        const isFirst = i === 0;
        const isLast = i === SPEED_OPTIONS.length - 1;
        return (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            style={{
              height: 28,
              padding: "0 8px",
              border: "1px solid",
              borderColor: active
                ? "var(--mer-stroke-accent)"
                : "var(--mer-stroke-hairline)",
              borderRadius: isFirst
                ? "var(--mer-radius-sm) 0 0 var(--mer-radius-sm)"
                : isLast
                ? "0 var(--mer-radius-sm) var(--mer-radius-sm) 0"
                : "0",
              marginLeft: isFirst ? 0 : -1,
              position: "relative",
              zIndex: active ? 1 : 0,
              background: active
                ? "rgba(62, 111, 224, 0.16)"
                : "var(--mer-surface-2)",
              color: active
                ? "var(--mer-accent-300)"
                : "var(--mer-ink-secondary)",
              fontSize: "var(--fs-micro)",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
              cursor: "pointer",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {s}x
          </button>
        );
      })}
    </div>
  );
}
