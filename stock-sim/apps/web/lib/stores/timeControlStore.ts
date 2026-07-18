import { create } from "zustand";

export type PlaybackSpeed = 1 | 5 | 10 | 25 | 100;

export interface Bookmark {
  id: string;
  tick: number;
  label: string;
  timestamp: string;
}

export interface CustomDateRange {
  start: string;
  end: string;
}

export interface TimeControlState {
  isPlaying: boolean;
  speed: PlaybackSpeed;
  currentTick: number;
  totalTicks: number;
  timeRange: string;
  customRange: CustomDateRange | null;
  bookmarks: Bookmark[];
  replayMode: boolean;
}

export interface TimeControlActions {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stop: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  stepForward: () => void;
  stepBackward: () => void;
  goToTick: (tick: number) => void;
  setTotalTicks: (total: number) => void;
  setTimeRange: (range: string) => void;
  setCustomRange: (range: CustomDateRange | null) => void;
  setReplayMode: (enabled: boolean) => void;
  addBookmark: (label: string, timestamp: string) => void;
  removeBookmark: (id: string) => void;
  updateBookmarkLabel: (id: string, label: string) => void;
}

export type TimeControlStore = TimeControlState & TimeControlActions;

let bookmarkCounter = 0;

export const useTimeControlStore = create<TimeControlStore>((set, get) => ({
  isPlaying: false,
  speed: 1,
  currentTick: 0,
  totalTicks: 1000,
  timeRange: "ALL",
  customRange: null,
  bookmarks: [],
  replayMode: false,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  stop: () => set({ isPlaying: false, currentTick: 0 }),

  setSpeed: (speed) => set({ speed }),

  stepForward: () =>
    set((s) => ({
      currentTick: Math.min(s.currentTick + 1, s.totalTicks),
    })),

  stepBackward: () =>
    set((s) => ({
      currentTick: Math.max(s.currentTick - 1, 0),
    })),

  goToTick: (tick) =>
    set((s) => ({
      currentTick: Math.max(0, Math.min(tick, s.totalTicks)),
    })),

  setTotalTicks: (total) => set({ totalTicks: total }),

  setTimeRange: (range) => set({ timeRange: range, customRange: null }),

  setCustomRange: (range) => set({ customRange: range, timeRange: "CUSTOM" }),

  setReplayMode: (enabled) =>
    set((s) => ({
      replayMode: enabled,
      isPlaying: false,
      currentTick: enabled && !s.replayMode ? 0 : s.currentTick,
    })),

  addBookmark: (label, timestamp) => {
    const { currentTick, bookmarks } = get();
    bookmarkCounter += 1;
    const id = `bm-${Date.now()}-${bookmarkCounter}`;
    set({
      bookmarks: [...bookmarks, { id, tick: currentTick, label, timestamp }].sort(
        (a, b) => a.tick - b.tick
      ),
    });
  },

  removeBookmark: (id) =>
    set((s) => ({
      bookmarks: s.bookmarks.filter((b) => b.id !== id),
    })),

  updateBookmarkLabel: (id, label) =>
    set((s) => ({
      bookmarks: s.bookmarks.map((b) => (b.id === id ? { ...b, label } : b)),
    })),
}));
