import en from "../../messages/en.json";
import uk from "../../messages/uk.json";
import type { Locale } from "@/i18n/locales";

const COPY = {
  en: en.localePicker,
  uk: uk.localePicker,
} as const;

/** Dialog copy in the suggested locale (before the user picks a language). */
export function getLocalePickerCopy(locale: Locale) {
  return COPY[locale];
}
