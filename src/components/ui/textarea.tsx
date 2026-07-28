import * as React from "react";
import { cn } from "@/lib/utils";

/** Multi-line sibling of Input — same focus ring, same tokens. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full resize-y rounded-xl border border-line/60 bg-transparent p-3 text-sm text-fg outline-none transition-colors",
        "placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
