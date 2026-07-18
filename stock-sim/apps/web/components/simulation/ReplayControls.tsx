"use client";

import * as React from "react";
import { useTimeControlStore } from "@/lib/stores/timeControlStore";
import { SpeedControl } from "./SpeedControl";

export function ReplayControls() {
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
  const addBookmark = useTimeControlStore((s) => s.addBookmark);

  const [showBookmarkInput, setShowBookmarkInput] = React.useState(false);
  const [bookmarkLabel, setBookmarkLabel] = React.useState("");
  const barRef = React.useRef<HTMLDivElement>(null);

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
    if (!replayMode && currentTick >= totalTicks) goToTick(0);
    setReplayMode(true);
    togglePlay();
  }, [currentTick, goToTick, replayMode, setReplayMode, togglePlay, totalTicks]);

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
    if (!isPlaying) return;
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
  }, [isPlaying, speed]);

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

  function handleAddBookmark() {
    const now = new Date().toISOString();
    addBookmark(bookmarkLabel || `Tick ${currentTick}`, now);
    setBookmarkLabel("");
    setShowBookmarkInput(false);
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
        background: "var(--mer-surface-1)",
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
          {replayMode ? "Replay" : "Live"} · Tick {currentTick.toLocaleString()} / {totalTicks.toLocaleString()}
        </span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={() => setShowBookmarkInput(!showBookmarkInput)}
            title="Add bookmark"
            style={{
              ...transportBtnStyle,
              width: 28,
              height: 26,
              padding: 0,
            }}
          >
            <BookmarkIcon />
          </button>

          {showBookmarkInput && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="text"
                value={bookmarkLabel}
                onChange={(e) => setBookmarkLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddBookmark();
                  if (e.key === "Escape") setShowBookmarkInput(false);
                }}
                placeholder="Bookmark label"
                autoFocus
                style={{
                  height: 26,
                  width: 140,
                  padding: "0 8px",
                  border: "1px solid var(--mer-stroke-hairline)",
                  borderRadius: "var(--mer-radius-sm)",
                  background: "var(--mer-surface-2)",
                  color: "var(--mer-ink-primary)",
                  fontSize: "var(--fs-micro)",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={handleAddBookmark}
                style={{
                  height: 26,
                  padding: "0 8px",
                  border: "1px solid var(--mer-stroke-accent)",
                  borderRadius: "var(--mer-radius-sm)",
                  background: "rgba(62, 111, 224, 0.16)",
                  color: "var(--mer-accent-300)",
                  fontSize: "var(--fs-micro)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          )}
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

function BookmarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M3 2h8v10l-4-2.5L3 12V2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}
