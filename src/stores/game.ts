"use client";

import { create } from "zustand";

/**
 * ACTIVE GAME state, shared by pieces of chrome that live outside the board:
 * the site header (shows the game name as a subline instead of a second title
 * row), the game top bar (lives) and the bottom progress bar.
 *
 * A store rather than context: the board updates this on every answer, and
 * context would re-render the whole subtree under the provider on each change.
 * Here every consumer subscribes to just the slice it reads.
 *
 * Not persisted — a session dies with the page.
 */
interface GameState {
  /** game title, or null when not playing (header falls back to the logo alone) */
  title: string | null;
  /** index of the CURRENT card (0-based) */
  idx: number;
  total: number;
  lives: number;
  maxLives: number;
  /** one entry per ANSWERED card, in order: true = correct */
  results: boolean[];
  setTitle: (title: string | null) => void;
  sync: (s: Omit<GameState, "title" | "setTitle" | "sync" | "reset">) => void;
  reset: () => void;
}

const EMPTY = { idx: 0, total: 0, lives: 0, maxLives: 0, results: [] as boolean[] };

export const useGame = create<GameState>()((set) => ({
  title: null,
  ...EMPTY,
  setTitle: (title) => set({ title }),
  sync: (s) => set(s),
  reset: () => set({ title: null, ...EMPTY }),
}));
