"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

/**
 * A short fade-and-rise on every route change, so navigation reads as motion
 * instead of a hard cut.
 *
 * Keyed by pathname and enter-only (no AnimatePresence): the App Router swaps
 * RSC children synchronously, so there's no reliable "old tree" to animate out
 * — faking one makes the previous page flash back. Entering alone is what
 * actually reads as smooth.
 *
 * Once the animation finishes the wrapper drops back to a plain div. That
 * matters: a lingering `transform` makes the element a containing block for
 * `position: fixed` children, which would quietly break every modal on the
 * page (the rename dialog, share sheet…).
 *
 * Skipped while playing — those screens are fixed-height with their own card
 * animations and a wrapper transform would fight them.
 */
const SKIP = [/^\/play\/[^/]+\/[^/]+$/, /^\/play$/, /^\/admin/];
const SHELL = "flex min-h-0 flex-1 flex-col";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (SKIP.some((re) => re.test(pathname))) {
    return <div className={SHELL}>{children}</div>;
  }
  // key remounts Fade on navigation, which resets its "done" state for free
  return (
    <Fade key={pathname}>{children}</Fade>
  );
}

function Fade({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);

  if (done) return <div className={SHELL}>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => setDone(true)}
      className={SHELL}
    >
      {children}
    </motion.div>
  );
}
