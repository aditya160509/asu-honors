"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useTimeControlStore } from "@/lib/stores/timeControlStore";
import { SpeedControl } from "./SpeedControl";
import { useAdvance, useSimState } from "@/lib/api/hooks/useSimulation";
import { formatDateFull } from "@/lib/utils";

const ADVANCE_OPTIONS = [1, 5, 30] as const;
const LIVE_TICK_GAP_MS = 150;

export function ReplayControls() {
  const simState = useSimState();
  const advance = useAdvance();
  const isPlaying = useTimeControlStore((s) => s.isPlaying);
  const currentTick = useTimeControlStore((s) => s.currentTick);
  const totalTicks = useTimeControlStore((s) => s.totalTicks);
  const speed = useTimeControlStore((s) => s.speed);
  const togglePlay = useTimeControlStore((s) => s.togglePlay);
  const pause = useTimeControlStore((s) => s.pause);
  const stepForward = useTimeControlStore((s) => s.stepForward);
  const stepBackward = useTimeControlStore((s) => s.stepBackward);
  const goToTick = useTimeControlStore((s) => s.goToTick);
  const replayMode = useTimeControlStore((s) => s.replayMode);
  const setReplayMode = useTimeControlStore((s) => s.setReplayMode);

  const barRef = React.useRef<HTMLDivElement>(null);
  const timelineId = simState.data?.timeline_id;
  const advanceRef = React.useRef(advance);
  advanceRef.current = advance;

  const skipToStart = React.useCallback(() => {
    setReplayMode(true);
    goToTick(0);
  }, [goToTick, setReplayMode]);
  const skipToEnd = React.useCallback(() => {
    pause();
    setReplayMode(false);
    goToTick(totalTicks);
  }, [goToTick, pause, setReplayMode, totalTicks]);

  const handleTogglePlay = React.useCallback(() => {
    setReplayMode(false);
    togglePlay();
  }, [setReplayMode, togglePlay]);

  const handleStepForward = React.useCallback(() => {
    setReplayMode(true);
    pause();
    stepForward();
  }, [pause, setReplayMode, stepForward]);

  const handleStepBackward = React.useCallback(() => {
    setReplayMode(true);
    pause();
    stepBackward();
  }, [pause, setReplayMode, stepBackward]);

  React.useEffect(() => {
    if (!isPlaying || !replayMode) return;
    const intervalMs = Math.max(10, 1000 / speed);
    const id = setInterval(() => {
      const state = useTimeControlStore.getState();
      if (state.currentTick >= state.totalTicks) {
        state.pause();
        return;
      }
      state.stepForward();
    }, intervalMs);
    return () => clearInterval(id);
  }, [isPlaying, replayMode, speed]);

  React.useEffect(() => {
    if (!isPlaying || replayMode || !timelineId) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function fireNext() {
      if (cancelled || !timelineId) return;
      advanceRef.current.mutate(
        { timeline_id: timelineId, days: 1 },
        {
          onSettled: () => {
            if (!cancelled) timeoutId = setTimeout(fireNext, LIVE_TICK_GAP_MS);
          },
        }
      );
    }

    fireNext();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isPlaying, replayMode, timelineId]);

  React.useEffect(() => {
    if (advance.isError) pause();
  }, [advance.isError, pause]);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          handleTogglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          handleStepForward();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleStepBackward();
          break;
        case "Home":
          e.preventDefault();
          skipToStart();
          break;
        case "End":
          e.preventDefault();
          skipToEnd();
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTogglePlay, handleStepForward, handleStepBackward, skipToStart, skipToEnd]);

  function handleScrub(e: React.MouseEvent<HTMLDivElement>) {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    pause();
    setReplayMode(true);
    goToTick(Math.round(ratio * totalTicks));
  }

  function handleAdvance(days: number) {
    if (!timelineId) return;
    pause();
    setReplayMode(false);
    advance.mutate({ timeline_id: timelineId, days });
  }

  const progress = totalTicks > 0 ? (currentTick / totalTicks) * 100 : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        padding: "6px 14px",
        borderTop: "1px solid var(--mer-stroke-hairline)",
        background: "linear-gradient(180deg, var(--mer-surface-2), var(--mer-surface-1))",
      }}
    >
      {/* Progress bar */}
      <div
        ref={barRef}
        onClick={handleScrub}
        style={{
          position: "relative",
          height: 5,
          borderRadius: 3,
          background: "var(--mer-surface-3)",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${progress}%`,
            borderRadius: 3,
            background: "var(--mer-accent-300)",
            transition: isPlaying ? "none" : "width 80ms",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${progress}%`,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "var(--mer-accent-300)",
            border: "2px solid var(--mer-bg-canvas)",
            transform: "translate(-50%, -50%)",
            boxShadow: "0 0 4px rgba(62, 111, 224, 0.4)",
          }}
        />
      </div>

      {/* Controls row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={skipToStart}
          title="Skip to start (Home)"
          style={transportBtnStyle}
        >
          <SkipToStartIcon />
        </button>

        <button
          type="button"
          onClick={handleStepBackward}
          title="Step backward (Left)"
          style={transportBtnStyle}
        >
          <StepBackIcon />
        </button>

        <button
          type="button"
          onClick={handleTogglePlay}
          title="Play/Pause (Space)"
          style={{
            ...transportBtnStyle,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "1px solid var(--mer-stroke-accent)",
            background: "rgba(62, 111, 224, 0.16)",
          }}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          type="button"
          onClick={handleStepForward}
          title="Step forward (Right)"
          style={transportBtnStyle}
        >
          <StepForwardIcon />
        </button>

        <button
          type="button"
          onClick={skipToEnd}
          title="Skip to end (End)"
          style={transportBtnStyle}
        >
          <SkipToEndIcon />
        </button>

        <div style={{ width: 1, height: 20, background: "var(--mer-stroke-hairline)", margin: "0 4px" }} />

        <SpeedControl />

        <div style={{ width: 1, height: 20, background: "var(--mer-stroke-hairline)", margin: "0 4px" }} />

        <span
          className="num"
          style={{
            fontSize: "var(--fs-micro)",
            color: "var(--mer-ink-secondary)",
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {replayMode ? "Replay" : isPlaying ? "Live" : "Paused"} · Tick {currentTick.toLocaleString()} / {totalTicks.toLocaleString()}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {ADVANCE_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              disabled={!timelineId || advance.isPending || isPlaying}
              onClick={() => handleAdvance(days)}
              style={{
                height: 28,
                minWidth: 44,
                padding: "0 10px",
                border: "1px solid var(--mer-stroke-hairline)",
                borderRadius: "var(--mer-radius-sm)",
                background: "var(--mer-surface-2)",
                color: "var(--mer-ink-primary)",
                fontSize: "var(--fs-small)",
                fontWeight: 700,
                cursor: !timelineId || advance.isPending || isPlaying ? "not-allowed" : "pointer",
                opacity: !timelineId || advance.isPending || isPlaying ? 0.55 : 1,
              }}
            >
              {advance.isPending ? <Loader2 size={12} className="animate-spin" /> : `${days}D`}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {advance.isError && (
            <span style={{ color: "var(--negative)", fontSize: "var(--fs-micro)" }}>
              {(advance.error as Error)?.message ?? "Advance failed"}
            </span>
          )}
          <span
            className="num"
            style={{
              color: "var(--mer-ink-tertiary)",
              fontSize: "var(--fs-micro)",
              fontFamily: "var(--font-mono)",
              whiteSpace: "nowrap",
            }}
          >
            {simState.data ? formatDateFull(simState.data.current_sim_date) : "No simulation"}
          </span>
        </div>
      </div>
    </div>
  );
}

const transportBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  border: "1px solid var(--mer-stroke-hairline)",
  borderRadius: "var(--mer-radius-sm)",
  background: "var(--mer-surface-2)",
  color: "var(--mer-ink-secondary)",
  cursor: "pointer",
  padding: 0,
};

function SkipToStartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="1.5" height="8" fill="currentColor" />
      <path d="M12 3L5 7l7 4V3z" fill="currentColor" />
    </svg>
  );
}

function StepBackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M10 3L4 7l6 4V3z" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M4 2.5v9l7-4.5L4 2.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="3" y="2.5" width="3" height="9" fill="currentColor" />
      <rect x="8" y="2.5" width="3" height="9" fill="currentColor" />
    </svg>
  );
}

function StepForwardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M4 3l6 4-6 4V3z" fill="currentColor" />
    </svg>
  );
}

function SkipToEndIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="11.5" y="3" width="1.5" height="8" fill="currentColor" />
      <path d="M2 3l7 4-7 4V3z" fill="currentColor" />
    </svg>
  );
}
