import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LocalePickerDialog } from "@/components/locale-picker-dialog";
import { PageTransition } from "@/components/page-transition";
import { QueryProvider } from "@/components/query-provider";
import { SwRegister } from "@/components/sw-register";
import { isLocale, LOCALE_COOKIE } from "@/i18n/locales";
import { getSuggestedLocale } from "@/lib/locale-cookie";
// Self-hosted variable fonts (no runtime Google Fonts dependency)
import "@fontsource-variable/manrope"; // includes latin + cyrillic subsets
import "@fontsource-variable/space-grotesk";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    metadataBase: new URL("https://wiqus.vercel.app"),
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("description"),
    applicationName: t("name"),
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    // link previews in messengers / social (og:image pulls the app icon)
    openGraph: {
      type: "website",
      siteName: t("name"),
      title: t("name"),
      description: t("description"),
      url: "/",
      images: [{ url: "/icon-512.png", width: 512, height: 512, alt: t("name") }],
    },
    twitter: {
      card: "summary",
      title: t("name"),
      description: t("description"),
      images: ["/icon-512.png"],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // game app: double-tap zoom breaks the arcade feel
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0913" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const store = await cookies();
  const needsLocalePick = !isLocale(store.get(LOCALE_COOKIE)?.value);
  const headerStore = await headers();
  const suggestedLocale = getSuggestedLocale(headerStore.get("accept-language"));

  return (
    <html lang={locale} suppressHydrationWarning className="antialiased">
      <body>
        {/* no-flash theme init: runs before paint, OUTSIDE React components */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var m=localStorage.getItem("wq-theme");var d=m==="dark"||((!m||m==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}`,
          }}
        />
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <QueryProvider>
            <div className="mystic-bg" aria-hidden />
            <div className="app-shell">
              <SiteHeader />
              <PageTransition>{children}</PageTransition>
              <SiteFooter />
            </div>
            <SwRegister />
            <LocalePickerDialog open={needsLocalePick} suggested={suggestedLocale} />
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
