"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Guest progression (game-pass style): which levels are completed per game.
 * Lives in localStorage; migrates into the account after sign-in (stage 2).
 */
export const MAX_STARS = 3;

interface ProgressState {
  completed: Record<string, number[]>; // slug -> completed level numbers
  bestScores: Record<string, number>; // slug -> best score
  /** slug -> level -> BEST star rating (1..3), = lives left when the level was passed */
  stars: Record<string, Record<number, number>>;
  markCompleted: (slug: string, level: number, stars?: number) => void;
  recordScore: (slug: string, score: number) => void;
  isCompleted: (slug: string, level: number) => boolean;
  isUnlocked: (slug: string, level: number) => boolean;
  starsFor: (slug: string, level: number) => number;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      completed: {},
      bestScores: {},
      stars: {},
      // stars = lives left (3 lives, one lost per wrong answer), so a flawless
      // run is 3 and scraping through on the last life is 1. Only ever raised —
      // replaying a level can improve the rating, never lose it.
      markCompleted: (slug, level, stars) =>
        set((s) => {
          const cur = new Set(s.completed[slug] ?? []);
          cur.add(level);
          const next: Partial<ProgressState> = {
            completed: { ...s.completed, [slug]: [...cur].sort((a, b) => a - b) },
          };
          if (stars != null) {
            const forGame = s.stars?.[slug] ?? {};
            const best = Math.max(forGame[level] ?? 0, Math.min(MAX_STARS, Math.max(0, stars)));
            next.stars = { ...s.stars, [slug]: { ...forGame, [level]: best } };
          }
          return next;
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
      // `?? {}` guards saves written before ratings existed
      starsFor: (slug, level) => get().stars?.[slug]?.[level] ?? 0,
    }),
    { name: "wq-progress" },
  ),
);
