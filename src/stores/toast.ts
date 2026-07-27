"use client";

import { create } from "zustand";

/**
 * Minimal bottom toast — one at a time, auto-dismissing. Deliberately not a
 * toast library: the only caller so far is the layout switcher, which needs to
 * name the mode it just switched to.
 */
export interface ToastPayload {
  title: string;
  description?: string;
}

interface ToastState {
  toast: (ToastPayload & { id: number }) | null;
  show: (t: ToastPayload) => void;
  dismiss: () => void;
}

export const useToast = create<ToastState>()((set) => ({
  toast: null,
  // id changes on every call so re-showing the same text restarts the animation
  show: (t) => set({ toast: { ...t, id: Date.now() } }),
  dismiss: () => set({ toast: null }),
}));
