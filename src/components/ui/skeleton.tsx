import { cn } from "@/lib/utils";

/**
 * Loading placeholder. A shimmer rather than a spinner: it reserves the real
 * layout, so when the content lands nothing jumps — the page just resolves.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div aria-hidden className={cn("animate-pulse rounded-xl bg-accent-soft", className)} {...props} />
  );
}

/** Catalogue card placeholder — mirrors CategoryThumb + two text lines. */
function CardSkeleton() {
  return (
    <div className="glass-card flex flex-col overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

/** A grid of card placeholders, shaped like the real catalogue grid. */
function CardGridSkeleton({
  count = 8,
  className = "grid grid-cols-2 gap-3 sm:grid-cols-4",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export { Skeleton, CardSkeleton, CardGridSkeleton };
