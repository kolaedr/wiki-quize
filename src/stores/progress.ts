"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Guest progression (game-pass style): which levels are completed per game.
 * Lives in localStorage; migrates into the account after sign-in (stage 2).
 */
interface ProgressState {
  completed: Record<string, number[]>; // slug -> completed level numbers
  bestScores: Record<string, number>; // slug -> best score
  markCompleted: (slug: string, level: number) => void;
  recordScore: (slug: string, score: number) => void;
  isCompleted: (slug: string, level: number) => boolean;
  isUnlocked: (slug: string, level: number) => boolean;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      completed: {},
      bestScores: {},
      markCompleted: (slug, level) =>
        set((s) => {
          const cur = new Set(s.completed[slug] ?? []);
          cur.add(level);
          return { completed: { ...s.completed, [slug]: [...cur].sort((a, b) => a - b) } };
        }),
      recordScore: (slug, score) =>
        set((s) => ({
          bestScores: {
            ...s.bestScores,
            [slug]: Math.max(s.bestScores[slug] ?? 0, score),
          },
        })),
      isCompleted: (slug, level) => (get().completed[slug] ?? []).includes(level),
      isUnlocked: (slug, level) =>
        level === 1 || (get().completed[slug] ?? []).includes(level - 1),
    }),
    { name: "wq-progress" },
  ),
);
