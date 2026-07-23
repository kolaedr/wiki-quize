import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-accent-soft", className)} {...props} />
  );
}

export { Skeleton };
