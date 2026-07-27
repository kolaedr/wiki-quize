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
    }),
    { name: "wq-settings" },
  ),
);
