"use client";

import { useGame } from "@/stores/game";

/**
 * Deck progress, pinned to the bottom edge of the screen so it costs the game
 * area no vertical space at all.
 *
 * Three sections: half the deck's segments, the x/y counter, the other half.
 * A 10-card deck therefore reads as 5 · counter · 5. Each segment is one card:
 * filled = answered right, red = answered wrong, dim = still ahead.
 */
export function GameProgressBar() {
  const idx = useGame((s) => s.idx);
  const total = useGame((s) => s.total);
  const results = useGame((s) => s.results);

  if (total <= 0) return null;

  const half = Math.ceil(total / 2);
  const segment = (i: number) => {
    const answered = results[i];
    return (
      <span
        key={i}
        className={`h-1.5 flex-1 rounded-full transition-colors ${
          answered === undefined
            ? i === idx
              ? "bg-accent/40"
              : "bg-line"
            : answered
              ? "bg-accent"
              : "bg-danger"
        }`}
      />
    );
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-center gap-2.5 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
      <span className="flex flex-1 items-center gap-1">
        {Array.from({ length: half }, (_, i) => segment(i))}
      </span>
      <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted">
        {Math.min(idx + 1, total)}/{total}
      </span>
      <span className="flex flex-1 items-center gap-1">
        {Array.from({ length: total - half }, (_, i) => segment(half + i))}
      </span>
    </div>
  );
}
