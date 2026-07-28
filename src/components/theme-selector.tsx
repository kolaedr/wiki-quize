"use client";

import { useTranslations } from "next-intl";
import { ToggleGroup } from "@/components/ui/toggle";
import { useTheme, type ThemeMode } from "@/components/theme-provider";

const MODES: ThemeMode[] = ["system", "light", "dark"];

/** Labeled theme picker — for account settings and similar forms. */
export function ThemeSelector() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();

  return (
    <ToggleGroup
      label={t("label")}
      variant="plain"
      size="sm"
      value={theme as ThemeMode}
      onChange={setTheme}
      options={MODES.map((mode) => ({ value: mode, label: t(mode) }))}
    />
  );
}
