"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useToast } from "@/stores/toast";

const VISIBLE_MS = 2200;

/**
 * Bottom toast host. Sits above the game's progress bar and below everything
 * else; `pointer-events-none` so it never eats a swipe mid-game.
 */
export function Toaster() {
  const toast = useToast((s) => s.toast);
  const dismiss = useToast((s) => s.dismiss);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(dismiss, VISIBLE_MS);
    return () => clearTimeout(id);
  }, [toast, dismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            role="status"
            aria-live="polite"
            className="glass-card shadow-glow flex max-w-xs flex-col items-center gap-0.5 px-4 py-2.5 text-center"
          >
            <span className="text-sm font-semibold leading-tight">{toast.title}</span>
            {toast.description && (
              <span className="text-[11px] leading-4 text-muted">{toast.description}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
