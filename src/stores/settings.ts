"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Global user preferences (guest: localStorage; after sign-in they will
 * migrate to the account — stage 2). One game — several presentation
 * layouts; the layout is a user setting, not a separate game.
 *
 * single — one card, swipe right = true / left = false
 * duel   — a pair of cards, fling toward the answer
 * quad   — four options, tap
 */
export type ChoiceLayout = "single" | "duel" | "quad";

interface SettingsState {
  layout: ChoiceLayout;
  setLayout: (l: ChoiceLayout) => void;
  /** answer sounds — OFF by default: a quiz often gets opened somewhere quiet */
  sound: boolean;
  setSound: (on: boolean) => void;
  toggleSound: () => void;
  /** duel layout: how many cards to choose from (2 = classic, 3 = harder) */
  duelCount: 2 | 3;
  setDuelCount: (n: 2 | 3) => void;
  /**
   * Stack the duel/trio cards in a COLUMN instead of side by side. Null = follow
   * the game's own default (`config.stackedDefault`), which is what a dataset of
   * wide photos wants; once the player touches the switch their choice wins.
   */
  stacked: boolean | null;
  setStacked: (v: boolean | null) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      layout: "duel",
      setLayout: (layout) => set({ layout }),
      // persist merges over these defaults, so saves written before this
      // option existed simply start muted
      sound: false,
      setSound: (sound) => set({ sound }),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      duelCount: 2,
      setDuelCount: (duelCount) => set({ duelCount }),
      stacked: null,
      setStacked: (stacked) => set({ stacked }),
    }),
    { name: "wq-settings" },
  ),
);
