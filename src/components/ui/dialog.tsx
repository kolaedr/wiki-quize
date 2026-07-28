"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one modal in the app.
 *
 * Six components had each grown their own — same overlay, same
 * stopPropagation, same Escape listener copied four times — and they had
 * drifted: some closed on backdrop click, some didn't, none locked the body
 * scroll, and one broke outright when its parent picked up a CSS transform.
 *
 * Portalled to <body> for exactly that reason: a transformed ancestor (a page
 * transition, a tilted card) turns `position: fixed` into "fixed relative to
 * that element", which pins the overlay to the wrong box.
 *
 * Mount it conditionally OR pass `open` — both work; `open` gives you the
 * exit animation.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  /** hide the default close button when the content provides its own */
  hideClose = false,
  /** clicking the backdrop closes; off for flows that must be answered */
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  hideClose?: boolean;
  dismissible?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    // the page behind must not scroll under the modal
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, dismissible]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={dismissible ? onClose : undefined}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-line bg-bg p-5 shadow-2xl",
              className,
            )}
          >
            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-3">
                {title ? (
                  <h3 className="font-display text-lg font-bold">{title}</h3>
                ) : (
                  <span />
                )}
                {!hideClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Закрити"
                    className="text-muted transition-colors hover:text-fg"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
