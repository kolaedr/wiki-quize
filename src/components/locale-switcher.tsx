"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ACTIVE_LOCALES, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/locales";

/** Flag + short label for each locale (emoji flags — no asset deps). */
const LOCALES: Record<Locale, { flag: string; label: string }> = {
  en: { flag: "🇬🇧", label: "EN" },
  uk: { flag: "🇺🇦", label: "UA" },
};

const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

/** Compact flag toggle — writes cookie and refreshes RSC tree. */
export function LocaleSwitcher() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const router = useRouter();
  const current: Locale = isLocale(locale) ? locale : "en";

  return (
    <div role="group" aria-label={t("language")} className="flex items-center gap-1.5">
      {ACTIVE_LOCALES.map((code) => {
        const active = code === current;
        const { flag, label } = LOCALES[code];
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => {
              if (code === current) return;
              setLocaleCookie(code);
              router.refresh();
            }}
            className={`flex h-6 items-center gap-1.5 rounded-lg border px-1.5 text-sm transition-all active:scale-95 ${
              active
                ? "border-accent bg-accent-soft text-fg"
                : "border-transparent text-muted hover:border-line hover:text-fg"
            }`}
          >
            <span className="text-base leading-none" aria-hidden>
              {flag}
            </span>
            <span className="text-xs font-semibold tracking-wide">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
