"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ACTIVE_LOCALES, type Locale } from "@/i18n/locales";
import { LOCALE_META, setLocaleCookie } from "@/lib/locale-cookie";

/**
 * First-visit language picker — shown when no wq-locale cookie exists yet.
 * Two large flag buttons; choice persists via cookie + router.refresh().
 */
export function LocalePickerDialog({
  open,
  suggested,
}: {
  open: boolean;
  suggested: Locale;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const pick = (locale: Locale) => {
    setLocaleCookie(locale);
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      aria-hidden={false}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="locale-picker-title"
        className="glass-card flex w-full max-w-sm flex-col gap-5 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h2
            id="locale-picker-title"
            className="font-display text-xl font-bold tracking-tight"
          >
            Choose language
          </h2>
          <p className="mt-1 text-sm text-muted">Оберіть мову</p>
        </div>

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
      </div>
    </div>
  );
}
