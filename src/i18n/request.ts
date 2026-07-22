import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE } from "./locales";

/**
 * next-intl without locale routing for now (EN only, stage 1).
 * Stage 2 (UA): switch to cookie/header-based locale or [locale] routing.
 */
export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
