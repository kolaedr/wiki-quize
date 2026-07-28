import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The app's surfaces, as one component instead of three CSS classes people had
 * to remember by name (`glass-card`, `white-card`, `play-card`). The classes
 * still live in globals.css — this just gives them a typed door.
 *
 * glass — the default themed frosted panel.
 * white — always-light popover surface (search suggestions).
 * play  — a playing card: light with dark text in BOTH themes.
 */
const cardVariants = cva("", {
  variants: {
    variant: {
      glass: "glass-card",
      white: "white-card",
      play: "play-card",
    },
  },
  defaultVariants: { variant: "glass" },
});

export function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}

export { cardVariants };
