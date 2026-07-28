"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ToggleGroup } from "@/components/ui/toggle";
import { ACTIVE_LOCALES, isLocale, type Locale } from "@/i18n/locales";
import { LOCALE_META, setLocaleCookie } from "@/lib/locale-cookie";

/** Compact flag toggle — writes cookie and refreshes RSC tree. */
export function LocaleSwitcher() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const router = useRouter();
  const current: Locale = isLocale(locale) ? locale : "en";

  return (
    <ToggleGroup
      label={t("language")}
      variant="ghost"
      size="sm"
      className="gap-1.5"
      value={current}
      onChange={(code) => {
        if (code === current) return;
        setLocaleCookie(code);
        router.refresh();
      }}
      options={ACTIVE_LOCALES.map((code) => {
        const { flag, short } = LOCALE_META[code];
        return {
          value: code,
          title: short,
          icon: (
            <span className="text-base leading-none" aria-hidden>
              {flag}
            </span>
          ),
          label: <span className="text-xs font-semibold tracking-wide">{short}</span>,
        };
      })}
    />
  );
}
