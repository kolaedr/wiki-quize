"use client";

import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSelector } from "@/components/theme-selector";

/** Language + appearance controls for the signed-in account page. */
export function AccountPreferences() {
  const t = useTranslations("me");

  return (
    <section className="glass-card flex flex-col gap-4 p-5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
        {t("preferences")}
      </h2>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("language")}</span>
        <LocaleSwitcher />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("appearance")}</span>
        <ThemeSelector />
      </div>
    </section>
  );
}
