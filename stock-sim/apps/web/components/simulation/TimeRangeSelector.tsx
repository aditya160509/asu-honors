"use client";

import * as React from "react";
import { useTimeControlStore } from "@/lib/stores/timeControlStore";

const TIME_RANGES = [
  { label: "1D", days: 1 },
  { label: "5D", days: 5 },
  { label: "10D", days: 10 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "YTD", days: -1 },
  { label: "1Y", days: 365 },
  { label: "ALL", days: null },
] as const;

export function TimeRangeSelector({ compact = false }: { compact?: boolean }) {
  const timeRange = useTimeControlStore((s) => s.timeRange);
  const setTimeRange = useTimeControlStore((s) => s.setTimeRange);
  const customRange = useTimeControlStore((s) => s.customRange);
  const setCustomRange = useTimeControlStore((s) => s.setCustomRange);
  const setReplayMode = useTimeControlStore((s) => s.setReplayMode);

  const [showCustom, setShowCustom] = React.useState(false);
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");

  function handleApplyCustom() {
    if (start && end) {
      setCustomRange({ start, end });
      setTimeRange("CUSTOM");
      setReplayMode(false);
      setShowCustom(false);
    }
  }

  function handleClearCustom() {
    setCustomRange(null);
    setTimeRange("ALL");
    setStart("");
    setEnd("");
  }

  return (
    <div style={{ display: "flex", flexDirection: compact ? "row" : "column", alignItems: compact ? "center" : undefined, gap: compact ? 4 : 6, position: "relative" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 2,
          padding: 2,
          border: "1px solid var(--mer-stroke-hairline)",
          borderRadius: 8,
          background: "rgba(255,255,255,0.025)",
        }}
      >
        {TIME_RANGES.map((range) => {
          const active = timeRange === range.label && !customRange;
          return (
            <button
              key={range.label}
              type="button"
              onClick={() => {
                setTimeRange(range.label);
                setCustomRange(null);
                setReplayMode(false);
              }}
              style={{
                height: compact ? 24 : 28,
                padding: compact ? "0 8px" : "0 10px",
                border: "1px solid transparent",
                borderRadius: 6,
                background: active
                  ? "var(--mer-surface-4)"
                  : "transparent",
                color: active
                  ? "var(--mer-accent-300)"
                  : "var(--mer-ink-secondary)",
                fontSize: "var(--fs-micro)",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {range.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          style={{
            height: compact ? 24 : 28,
            padding: compact ? "0 8px" : "0 10px",
            border: "1px solid transparent",
            borderRadius: 6,
            background: customRange
              ? "var(--mer-surface-4)"
              : "transparent",
            color: customRange
              ? "var(--mer-accent-300)"
              : "var(--mer-ink-secondary)",
            fontSize: "var(--fs-micro)",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Custom
        </button>
      </div>

      {customRange && !compact && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--fs-micro)",
            color: "var(--mer-accent-300)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>{customRange.start}</span>
          <span style={{ color: "var(--mer-ink-tertiary)" }}>to</span>
          <span>{customRange.end}</span>
          <button
            type="button"
            onClick={handleClearCustom}
            style={{
              marginLeft: 4,
              height: 20,
              padding: "0 6px",
              border: "1px solid var(--mer-stroke-hairline)",
              borderRadius: "var(--mer-radius-sm)",
              background: "var(--mer-surface-2)",
              color: "var(--mer-ink-secondary)",
              fontSize: "var(--fs-micro)",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      )}

      {showCustom && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            border: "1px solid var(--mer-stroke-hairline)",
            borderRadius: "var(--mer-radius-sm)",
            background: "var(--mer-surface-2)",
            position: compact ? "absolute" : undefined,
            zIndex: compact ? 60 : undefined,
            top: compact ? 34 : undefined,
            left: compact ? 0 : undefined,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: "var(--fs-micro)",
              color: "var(--mer-ink-tertiary)",
            }}
          >
            Start
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              style={{
                height: 26,
                padding: "0 6px",
                border: "1px solid var(--mer-stroke-hairline)",
                borderRadius: "var(--mer-radius-sm)",
                background: "var(--mer-surface-1)",
                color: "var(--mer-ink-primary)",
                fontSize: "var(--fs-micro)",
                fontFamily: "var(--font-mono)",
              }}
            />
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: "var(--fs-micro)",
              color: "var(--mer-ink-tertiary)",
            }}
          >
            End
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              style={{
                height: 26,
                padding: "0 6px",
                border: "1px solid var(--mer-stroke-hairline)",
                borderRadius: "var(--mer-radius-sm)",
                background: "var(--mer-surface-1)",
                color: "var(--mer-ink-primary)",
                fontSize: "var(--fs-micro)",
                fontFamily: "var(--font-mono)",
              }}
            />
          </label>
          <button
            type="button"
            onClick={handleApplyCustom}
            disabled={!start || !end}
            style={{
              height: 26,
              padding: "0 10px",
              border: "1px solid var(--mer-stroke-accent)",
              borderRadius: "var(--mer-radius-sm)",
              background: "rgba(62, 111, 224, 0.16)",
              color: "var(--mer-accent-300)",
              fontSize: "var(--fs-micro)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setShowCustom(false)}
            style={{
              height: 26,
              padding: "0 10px",
              border: "1px solid var(--mer-stroke-hairline)",
              borderRadius: "var(--mer-radius-sm)",
              background: "var(--mer-surface-2)",
              color: "var(--mer-ink-secondary)",
              fontSize: "var(--fs-micro)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
