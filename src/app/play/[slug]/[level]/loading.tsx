import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for a ROUND — not the level map.
 *
 * Without this file the route inherited /play/[slug]/loading.tsx and flashed a
 * grid of level tiles before the board appeared, which read as navigating to
 * the wrong screen. This mirrors the default (duel) board instead: the header
 * strip, the question image, a pair of tilted cards and the bottom progress
 * bar — so the real board lands into the same silhouette.
 */
export default function RoundLoading() {
  return (
    <>
      {/* header strip: back · lives · mode */}
      <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-5 pb-6 pt-1">
        <Skeleton className="h-10 w-10 rounded-full" />
        <span className="flex flex-1 items-center justify-center gap-1">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-4 rounded-full" />
          ))}
        </span>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>

      <main className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 pb-10">
        {/* question: big picture + a line of text under it */}
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Skeleton className="h-40 w-[80%] max-w-md rounded-xl" />
          <Skeleton className="h-6 w-52" />
        </div>

        {/* the hand — two cards at the same rest angle the board uses */}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Skeleton
            className="-mr-4 aspect-[5/7] w-[44%] max-w-52"
            style={{ rotate: "-8deg", transformOrigin: "bottom center" }}
          />
          <Skeleton
            className="-ml-4 aspect-[5/7] w-[44%] max-w-52"
            style={{ rotate: "8deg", transformOrigin: "bottom center" }}
          />
        </div>
      </main>

      {/* bottom progress bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-center gap-2.5 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
        <span className="flex flex-1 items-center gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-1.5 flex-1 rounded-full" />
          ))}
        </span>
        <Skeleton className="h-3 w-8" />
        <span className="flex flex-1 items-center gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-1.5 flex-1 rounded-full" />
          ))}
        </span>
      </div>
    </>
  );
}
