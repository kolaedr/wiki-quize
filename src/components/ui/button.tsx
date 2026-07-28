"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** shadcn-style Button mapped to the Wiqus design tokens. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50 active:scale-95 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-accent text-white shadow-glow hover:opacity-90",
        secondary: "bg-accent-soft text-accent hover:bg-accent-soft/70",
        ghost: "text-muted hover:bg-accent-soft hover:text-accent",
        glass: "glass-card text-fg hover:border-accent",
        destructive: "bg-danger text-white hover:opacity-90",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-7",
        icon: "h-10 w-10",
        /** round icon button — the game chrome (back, layout, sound) */
        iconRound: "h-10 w-10 rounded-full",
        iconRoundSm: "h-8 w-8 rounded-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

export { Button, buttonVariants };
