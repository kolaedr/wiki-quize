import { LOCALE_COOKIE, type Locale } from "@/i18n/locales";

export const LOCALE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Flag + labels for each locale (emoji flags — no asset deps). */
export const LOCALE_META: Record<
  Locale,
  { flag: string; short: string; native: string }
> = {
  en: { flag: "🇬🇧", short: "EN", native: "English" },
  uk: { flag: "🇺🇦", short: "UA", native: "Українська" },
};

export function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_MAX_AGE}; samesite=lax`;
}

/** Client-side check — whether the locale cookie is already set. */
export function hasLocaleCookie(): boolean {
  if (typeof document === "undefined") return true;
  return document.cookie.split(";").some((part) => {
    const [name] = part.trim().split("=");
    return name === LOCALE_COOKIE;
  });
}

/** Guess locale from Accept-Language header or navigator.language. */
export function getSuggestedLocale(source?: string | null): Locale {
  const lang = (source ?? "").toLowerCase();
  if (lang.startsWith("uk") || lang.includes("uk-")) return "uk";
  return "en";
}
