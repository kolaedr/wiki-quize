"use client";

import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { ACTIVE_LOCALES, type Locale } from "@/i18n/locales";
import { getLocalePickerCopy } from "@/i18n/locale-picker-copy";
import { LOCALE_META, setLocaleCookie } from "@/lib/locale-cookie";

/**
 * First-visit language picker — shown when no wq-locale cookie exists yet.
 * Title uses the suggested locale (Accept-Language); flags show native names.
 */
export function LocalePickerDialog({
  open,
  suggested,
}: {
  open: boolean;
  suggested: Locale;
}) {
  const router = useRouter();
  const copy = getLocalePickerCopy(suggested);

  const pick = (locale: Locale) => {
    setLocaleCookie(locale);
    router.refresh();
  };

  return (
    // not dismissible: the app needs a language before anything reads right
    <Dialog open={open} onClose={() => {}} hideClose dismissible={false} className="gap-5 p-6">
      <h2 className="text-center font-display text-xl font-bold tracking-tight">{copy.title}</h2>

      <div className="grid grid-cols-2 gap-3">
        {ACTIVE_LOCALES.map((code) => {
            const { flag, native } = LOCALE_META[code];
            const isSuggested = code === suggested;
            return (
              <button
                key={code}
                type="button"
                onClick={() => pick(code)}
                className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-5 transition-all active:scale-[0.98] ${
                  isSuggested
                    ? "border-accent bg-accent-soft shadow-[0_0_0_1px_var(--accent)]"
                    : "border-line bg-bg/50 hover:border-accent/50 hover:bg-accent-soft/40"
                }`}
              >
                <span className="text-5xl leading-none" aria-hidden>
                  {flag}
                </span>
                <span className="font-display text-sm font-semibold">{native}</span>
              </button>
            );
          })}
      </div>
    </Dialog>
  );
}
