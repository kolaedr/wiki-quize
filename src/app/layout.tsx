import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import { SwRegister } from "@/components/sw-register";
// Self-hosted variable fonts (no runtime Google Fonts dependency)
import "@fontsource-variable/manrope"; // includes latin + cyrillic subsets
import "@fontsource-variable/space-grotesk";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("description"),
    applicationName: t("name"),
    manifest: "/manifest.webmanifest",
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

  return (
    <html lang={locale} suppressHydrationWarning className="antialiased">
      <body>
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <div className="mystic-bg" aria-hidden />
            <div className="app-shell">{children}</div>
            <SwRegister />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
