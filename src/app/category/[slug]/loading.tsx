import { Skeleton, CardGridSkeleton } from "@/components/ui/skeleton";

export default function CategoryLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-4">
      <Skeleton className="h-4 w-44" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-16" />
        <Skeleton className="h-7 w-52" />
      </div>
      <CardGridSkeleton count={6} className="grid grid-cols-2 gap-3 sm:grid-cols-3" />
    </main>
  );
}
