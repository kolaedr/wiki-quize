"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Pressed/unpressed pill — the shape five different places had each rebuilt
 * (sound, theme toggle, theme selector, locale switcher, game layout picker),
 * every one with its own idea of what "active" looks like.
 *
 * `pressed` drives both the styling and `aria-pressed`, so the accessible
 * state can't drift away from the visual one.
 */
const toggleVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 font-medium transition-colors active:scale-95 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /** framed pill — settings rows, the layout picker */
        glass: "glass-card",
        /** bare — footer strip, inline controls */
        plain: "rounded-lg border border-line/60",
        /** no chrome at all, just the colour change */
        ghost: "rounded-lg",
      },
      size: {
        sm: "h-8 px-2.5 text-xs",
        md: "h-10 px-3 text-sm",
        /** square icon-only */
        icon: "h-10 w-10 rounded-full",
        iconSm: "h-6 w-6 rounded-lg",
        /** stacked icon over label — the mode picker */
        stack: "flex-col gap-1 px-2 py-2 text-[11px]",
      },
    },
    defaultVariants: { variant: "glass", size: "md" },
  },
);

export function Toggle({
  pressed,
  onPressedChange,
  className,
  children,
  variant,
  size,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> &
  VariantProps<typeof toggleVariants> & {
    pressed: boolean;
    onPressedChange?: (next: boolean) => void;
  }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={(e) => {
        props.onClick?.(e);
        onPressedChange?.(!pressed);
      }}
      className={cn(
        toggleVariants({ variant, size }),
        pressed ? "border-accent text-accent" : "text-muted hover:text-fg",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * A row of mutually exclusive Toggles. Renders as a real radiogroup so arrow
 * keys and screen readers behave, instead of a handful of buttons that merely
 * look like a choice.
 */
export function ToggleGroup<T extends string>({
  value,
  onChange,
  options,
  className,
  variant,
  size,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label?: React.ReactNode; icon?: React.ReactNode; title?: string }[];
  className?: string;
  variant?: VariantProps<typeof toggleVariants>["variant"];
  size?: VariantProps<typeof toggleVariants>["size"];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex items-stretch gap-2", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            type="button"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              toggleVariants({ variant, size }),
              "flex-1",
              on ? "border-accent text-accent" : "text-muted hover:text-fg",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
