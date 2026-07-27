"use client";

import { useTranslations } from "next-intl";
import { useTheme, type ThemeMode } from "@/components/theme-provider";

const MODES: ThemeMode[] = ["system", "light", "dark"];

/** Labeled theme picker — for account settings and similar forms. */
export function ThemeSelector() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();

  return (
    <div role="group" aria-label={t("label")} className="flex flex-wrap gap-1.5">
      {MODES.map((mode) => {
        const active = theme === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(mode)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all active:scale-95 ${
              active
                ? "border-accent bg-accent-soft text-fg"
                : "border-line text-muted hover:border-accent/50 hover:text-fg"
            }`}
          >
            {t(mode)}
          </button>
        );
      })}
    </div>
  );
}
