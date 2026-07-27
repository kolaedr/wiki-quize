import { Skeleton, CardGridSkeleton } from "@/components/ui/skeleton";

/** Home placeholder — same rhythm as page.tsx: hero, then the category grid. */
export default function HomeLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-6">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex items-center justify-between px-1">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <CardGridSkeleton />
      <Skeleton className="h-11 w-full" />
    </main>
  );
}
