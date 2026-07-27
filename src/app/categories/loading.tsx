import { Skeleton, CardGridSkeleton } from "@/components/ui/skeleton";

export default function CategoriesLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-9 w-full" />
      <CardGridSkeleton count={9} className="grid grid-cols-2 gap-3 sm:grid-cols-3" />
    </main>
  );
}
