"use client";

import * as React from "react";
import { useTimeControlStore } from "@/lib/stores/timeControlStore";
import { SpeedControl } from "./SpeedControl";
import { useAdvance, useSimState } from "@/lib/api/hooks/useSimulation";
import { formatDateFull } from "@/lib/utils";

const MIN_LIVE_TICK_GAP_MS = 180;

interface ReplayControlsProps {
  replayPickMode?: boolean;
  onRequestReplayPick?: () => void;
  onCancelReplayPick?: () => void;
}

export function ReplayControls({
  replayPickMode = false,
  onRequestReplayPick,
  onCancelReplayPick,
}: ReplayControlsProps) {
  const simState = useSimState();
  const advance = useAdvance();
  const isPlaying = useTimeControlStore((s) => s.isPlaying);
  const currentTick = useTimeControlStore((s) => s.currentTick);
  const totalTicks = useTimeControlStore((s) => s.totalTicks);
  const speed = useTimeControlStore((s) => s.speed);
  const play = useTimeControlStore((s) => s.play);
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
    if (replayMode) {
      if (isPlaying) pause();
      else play();
      return;
    }
    setReplayMode(false);
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play, replayMode, setReplayMode]);

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
          onSuccess: () => {
            const intervalMs = Math.max(MIN_LIVE_TICK_GAP_MS, 1200 / useTimeControlStore.getState().speed);
            if (!cancelled) timeoutId = setTimeout(fireNext, intervalMs);
          },
          onError: () => {
            useTimeControlStore.getState().pause();
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

  const progress = totalTicks > 0 ? (currentTick / totalTicks) * 100 : 0;
  const liveBlocked = !timelineId || (!replayMode && advance.isPending);

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
          disabled={(!timelineId && !replayMode) || (!replayMode && advance.isPending)}
          title={replayMode ? (isPlaying ? "Pause replay" : "Play replay") : isPlaying ? "Stop simulation" : "Start simulation"}
          style={{
            ...transportBtnStyle,
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "1px solid var(--mer-stroke-accent)",
            background: isPlaying ? "rgba(239, 68, 68, 0.16)" : "rgba(62, 111, 224, 0.18)",
            color: isPlaying ? "var(--negative)" : "var(--mer-accent-300)",
            cursor: (!timelineId && !replayMode) || (!replayMode && advance.isPending) ? "not-allowed" : "pointer",
            opacity: (!timelineId && !replayMode) || (!replayMode && advance.isPending) ? 0.55 : 1,
          }}
        >
          {isPlaying ? <StopIcon /> : <PlayIcon />}
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

        <button
          type="button"
          onClick={() => (replayPickMode ? onCancelReplayPick?.() : onRequestReplayPick?.())}
          title={replayPickMode ? "Cancel replay point selection" : "Pick a chart point to replay from"}
          style={{
            height: 28,
            padding: "0 10px",
            border: "1px solid",
            borderColor: replayPickMode ? "var(--mer-stroke-accent)" : "var(--mer-stroke-hairline)",
            borderRadius: "var(--mer-radius-sm)",
            background: replayPickMode ? "rgba(62, 111, 224, 0.18)" : "var(--mer-surface-2)",
            color: replayPickMode ? "var(--mer-accent-300)" : "var(--mer-ink-secondary)",
            fontSize: "var(--fs-micro)",
            fontWeight: 800,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Replay
        </button>

        <div style={{ width: 1, height: 20, background: "var(--mer-stroke-hairline)", margin: "0 4px" }} />

        <SpeedControl />

        <div style={{ width: 1, height: 20, background: "var(--mer-stroke-hairline)", margin: "0 4px" }} />

        <StatusPill active={isPlaying} busy={advance.isPending} replayMode={replayMode} blocked={liveBlocked} />

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
            {simState.data ? `${formatDateFull(simState.data.current_sim_date)} · Tick ${currentTick.toLocaleString()} / ${totalTicks.toLocaleString()}` : "No simulation"}
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

function StatusPill({
  active,
  busy,
  replayMode,
  blocked,
}: {
  active: boolean;
  busy: boolean;
  replayMode: boolean;
  blocked: boolean;
}) {
  const label = replayMode ? (active ? "Replaying" : "Replay") : active ? "Running" : busy ? "Advancing" : blocked ? "Offline" : "Ready";
  const color = replayMode ? "var(--mer-accent-300)" : active ? "var(--positive)" : busy ? "var(--mer-accent-300)" : blocked ? "var(--negative)" : "var(--mer-ink-secondary)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 26,
        padding: "0 10px",
        border: "1px solid var(--mer-stroke-hairline)",
        borderRadius: 999,
        background: "rgba(255,255,255,0.025)",
        color,
        fontSize: "var(--fs-micro)",
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          boxShadow: active ? "0 0 10px rgba(34,197,94,0.8)" : "none",
        }}
      />
      {label}
    </span>
  );
}

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

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="3.25" y="3.25" width="7.5" height="7.5" rx="1" fill="currentColor" />
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
