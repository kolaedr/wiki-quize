"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Global user preferences (guest: localStorage; after sign-in they will
 * migrate to the account — stage 2). One game — several presentation
 * layouts; the layout is a user setting, not a separate game.
 */
export type ChoiceLayout = "duel" | "quad";

interface SettingsState {
  layout: ChoiceLayout;
  setLayout: (l: ChoiceLayout) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      layout: "duel",
      setLayout: (layout) => set({ layout }),
    }),
    { name: "wq-settings" },
  ),
);
