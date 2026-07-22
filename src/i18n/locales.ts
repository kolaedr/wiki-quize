/**
 * Language strategy (see docs/PROJECT.md §10):
 * - UI strings: next-intl messages (messages/{locale}.json)
 * - Entity data: jsonb per-locale in DB ({"en": "...", "uk": "..."}), resolved server-side
 * - Question templates: templates/{locale}.json (hand-localized, not translated literally)
 *
 * An entity enters the game pool only if it has labels in ALL active locales.
 */
export const ACTIVE_LOCALES = ["en"] as const; // stage 2: +"uk"; stage 3: +"de","es","fr"
export const DEFAULT_LOCALE = "en";

export type Locale = (typeof ACTIVE_LOCALES)[number];

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
