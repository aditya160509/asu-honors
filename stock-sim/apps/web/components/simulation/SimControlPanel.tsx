"use client";

import * as React from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { useAdvance, useSimState } from "@/lib/api/hooks/useSimulation";
import { useCycleState } from "@/lib/api/hooks/useMarket";
import { useNews } from "@/lib/api/hooks/useNews";
import { CycleIndicator } from "@/components/simulation/CycleIndicator";
import { formatDateFull } from "@/lib/utils";
import type { NewsItem } from "@/lib/api/types";

const ADVANCE_OPTIONS = [1, 5, 30] as const;
const LIVE_TICK_GAP_MS = 150;

export function SimControlPanel() {
  const simState = useSimState();
  const cycle = useCycleState(simState?.data?.timeline_id);
  const advance = useAdvance();
  const news = useNews({
    timelineId: simState?.data?.timeline_id,
    limit: 10,
  });

  const [isLive, setIsLive] = React.useState(false);
  const timelineId = simState.data?.timeline_id;

  // Auto-advance one day at a time while live — a ref (not state) so the
  // scheduling closure always calls the current mutate function.
  const advanceRef = React.useRef(advance);
  advanceRef.current = advance;

  // Chains the next tick off the previous one's actual completion (onSettled)
  // instead of a fixed setInterval — runs as fast as the backend genuinely
  // responds instead of being capped at an arbitrary cadence, while the
  // small gap after each tick keeps individual ticks visible rather than a
  // blur, and guarantees no two advance calls ever overlap.
  React.useEffect(() => {
    if (!isLive || !timelineId) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function fireNext() {
      if (cancelled) return;
      advanceRef.current.mutate(
        { timeline_id: timelineId, days: 1 },
        { onSettled: () => { if (!cancelled) timeoutId = setTimeout(fireNext, LIVE_TICK_GAP_MS); } }
      );
    }
    fireNext();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLive, timelineId]);

  // A real failure (not just a slow tick) should stop the auto-play instead
  // of silently retrying forever against a broken backend.
  React.useEffect(() => {
    if (isLive && advance.isError) setIsLive(false);
  }, [isLive, advance.isError]);

  const isAdvancing = advance.isPending;
  const error = advance.isError ? (advance.error as Error)?.message : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--mer-surface-1)",
        border: "1px solid var(--mer-stroke-hairline)",
        borderRadius: 0,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid var(--mer-stroke-hairline)",
          background: "var(--mer-surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "var(--fs-micro)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--mer-ink-tertiary)",
          }}
        >
          Simulation Control
        </span>

        <button
          type="button"
          disabled={!simState.data}
          onClick={() => setIsLive((v) => !v)}
          title={isLive ? "Pause live simulation" : "Play — auto-advance one day at a time"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            height: 22,
            padding: "0 8px",
            border: "1px solid",
            borderColor: isLive ? "var(--positive)" : "var(--mer-stroke-hairline)",
            borderRadius: "var(--mer-radius-sm)",
            background: isLive ? "rgba(34, 197, 94, 0.14)" : "var(--mer-surface-3)",
            color: isLive ? "var(--positive)" : "var(--mer-ink-secondary)",
            fontSize: "var(--fs-micro)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: simState.data ? "pointer" : "not-allowed",
            opacity: simState.data ? 1 : 0.5,
          }}
        >
          {isLive ? <Pause size={11} /> : <Play size={11} />}
          {isLive ? "Live" : "Play"}
        </button>
      </div>

      {/* Date & Tick */}
      <div style={{ padding: "10px" }}>
        {simState.isLoading ? (
          <div
            style={{
              height: 48,
              background: "var(--mer-surface-2)",
              borderRadius: "var(--mer-radius-sm)",
            }}
            className="skeleton-shimmer"
          />
        ) : simState.data ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                className="num"
                style={{
                  fontSize: "var(--fs-h3)",
                  fontWeight: 700,
                  color: "var(--mer-ink-primary)",
                  lineHeight: 1.2,
                }}
              >
                {formatDateFull(simState.data.current_sim_date)}
              </div>
              {isLive && (
                <span
                  aria-hidden
                  className="animate-pulse"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--positive)",
                  }}
                />
              )}
            </div>
            <div
              className="num"
              style={{
                fontSize: "var(--fs-small)",
                color: "var(--mer-ink-tertiary)",
                marginTop: 2,
              }}
            >
              Tick #{simState.data.tick_count}
            </div>
          </>
        ) : (
          <div style={{ fontSize: "var(--fs-small)", color: "var(--mer-ink-tertiary)" }}>
            No active simulation
          </div>
        )}
      </div>

      {/* Cycle Phase */}
      {cycle.data && (
        <div
          style={{
            padding: "0 10px 10px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: "var(--fs-small)", color: "var(--mer-ink-tertiary)" }}>
            Phase
          </span>
          <CycleIndicator phase={cycle.data.cycle_phase} />
        </div>
      )}

      {/* Advance Buttons */}
      <div
        style={{
          padding: "0 10px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {error && (
          <div
            style={{
              fontSize: "var(--fs-micro)",
              color: "var(--negative)",
              marginBottom: 4,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 6 }}>
          {ADVANCE_OPTIONS.map((days) => (
            <button
              key={days}
              disabled={isAdvancing || isLive || !simState.data}
              onClick={() =>
                advance.mutate({
                  timeline_id: simState.data!.timeline_id,
                  days,
                })
              }
              style={{
                flex: 1,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                background: "var(--mer-surface-3)",
                border: "1px solid var(--mer-stroke-hairline)",
                borderRadius: "var(--mer-radius-sm)",
                color: "var(--mer-ink-primary)",
                fontSize: "var(--fs-small)",
                fontWeight: 500,
                cursor: isAdvancing || isLive ? "not-allowed" : "pointer",
                opacity: isAdvancing || isLive ? 0.5 : 1,
                transition: "background 100ms",
              }}
              onMouseEnter={(e) => {
                if (!isAdvancing && !isLive) e.currentTarget.style.background = "var(--mer-surface-4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--mer-surface-3)";
              }}
            >
              {isAdvancing && <Loader2 size={12} className="animate-spin" />}
              {days}D
            </button>
          ))}
        </div>

        {isAdvancing && (
          <div
            style={{
              fontSize: "var(--fs-micro)",
              color: "var(--mer-accent-500)",
              textAlign: "center",
            }}
          >
            Advancing simulation...
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--mer-stroke-hairline)", margin: "0 10px" }} />

      {/* News Feed */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: "8px 10px",
            borderBottom: "1px solid var(--mer-stroke-hairline)",
          }}
        >
          <span
            style={{
              fontSize: "var(--fs-micro)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--mer-ink-tertiary)",
            }}
          >
            News Feed
          </span>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 0",
          }}
        >
          {news.isLoading ? (
            <div style={{ padding: "8px 14px" }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                  height: 34,
                  marginBottom: 6,
                    background: "var(--mer-surface-2)",
                    borderRadius: "var(--mer-radius-sm)",
                  }}
                  className="skeleton-shimmer"
                />
              ))}
            </div>
          ) : news.data && news.data.length > 0 ? (
            news.data.map((item) => <NewsItemRow key={item.id} item={item} />)
          ) : (
            <div
              style={{
                padding: "12px 10px",
                fontSize: "var(--fs-small)",
                color: "var(--mer-ink-tertiary)",
                textAlign: "center",
              }}
            >
              No news yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "var(--positive)",
  negative: "var(--negative)",
  neutral: "var(--mer-ink-tertiary)",
};

function NewsItemRow({ item }: { item: NewsItem }) {
  return (
    <div
      style={{
        padding: "7px 10px",
        borderBottom: "1px solid var(--mer-stroke-hairline)",
        cursor: "pointer",
        transition: "background 100ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--mer-surface-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: SENTIMENT_COLOR[item.sentiment] ?? SENTIMENT_COLOR.neutral,
            marginTop: 4,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--fs-micro)",
              color: "var(--mer-ink-primary)",
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.headline}
          </div>
          <div
            className="num"
            style={{
              fontSize: "var(--fs-micro)",
              color: "var(--mer-ink-tertiary)",
              marginTop: 2,
            }}
          >
            {item.sim_date}
            {item.company_name && (
              <span style={{ marginLeft: 6, color: "var(--mer-ink-secondary)" }}>
                {item.company_name}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
