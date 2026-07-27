"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ACTIVE_LOCALES, isLocale, type Locale } from "@/i18n/locales";
import { LOCALE_META, setLocaleCookie } from "@/lib/locale-cookie";

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
        const { flag, short } = LOCALE_META[code];
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            aria-label={short}
            title={short}
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
            <span className="text-xs font-semibold tracking-wide">{short}</span>
          </button>
        );
      })}
    </div>
  );
}
