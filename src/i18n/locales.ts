/**
 * Language strategy (see docs/PROJECT.md §10):
 * - UI strings: next-intl messages (messages/{locale}.json)
 * - Entity data: jsonb per-locale in DB ({"en": "...", "uk": "..."}), resolved server-side
 * - Question templates: templates/{locale}.json (hand-localized, not translated literally)
 *
 * An entity enters the game pool only if it has labels in ALL active locales.
 */
export const ACTIVE_LOCALES = ["en", "uk"] as const; // stage 3: +"de","es","fr"
export const DEFAULT_LOCALE = "en";
/** Cookie used by locale switcher + getRequestConfig (no [locale] routing). */
export const LOCALE_COOKIE = "wq-locale";

export type Locale = (typeof ACTIVE_LOCALES)[number];

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (ACTIVE_LOCALES as readonly string[]).includes(value);
}

export type LocalizedText = Partial<Record<string, string>>;

/** Resolve a jsonb localized field to a plain string for the requested locale. */
export function resolveText(
  value: LocalizedText | null | undefined,
  locale: string,
  fallback = DEFAULT_LOCALE,
): string {
  if (!value) return "";
  return value[locale] ?? value[fallback] ?? Object.values(value)[0] ?? "";
}
