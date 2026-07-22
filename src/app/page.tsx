import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Play } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserButton } from "@/components/auth/user-button";
import { resolveText } from "@/i18n/locales";
import { listPublishedGames } from "@/lib/deck/from-db";

export const dynamic = "force-dynamic"; // catalog comes from the DB

export default async function Home() {
  const t = await getTranslations();
  const locale = await getLocale();
  const catalog = await listPublishedGames();

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-4">
        <span className="font-display text-lg font-semibold tracking-tight">
          {t("app.name")}
        </span>
        <div className="flex items-center gap-2">
          <UserButton />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-display max-w-xs bg-gradient-to-br from-fg via-fg to-accent bg-clip-text text-3xl font-bold leading-tight tracking-tight text-transparent">
            {t("app.tagline")}
          </h1>
          <p className="max-w-sm text-balance text-sm leading-6 text-muted">
            {t("app.description")}
          </p>
        </div>

        {catalog.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-display px-1 text-sm font-semibold uppercase tracking-wide text-muted">
              {t("home.catalog")}
            </h2>
            {catalog.map((g) => (
              <Link
                key={g.slug}
                href={`/play/${g.slug}`}
                className="glass-card flex items-center gap-4 p-4 transition-all hover:border-accent active:scale-[0.99]"
              >
                <span className="text-3xl">
                  {((g.style as { emoji?: string })?.emoji as string) ?? "🃏"}
                </span>
                <span className="flex-1 font-semibold">{resolveText(g.title, locale)}</span>
                <ChevronRight size={18} className="text-muted" />
              </Link>
            ))}
          </section>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {/* Card-stack teaser while the catalog is empty (DB not imported yet) */}
            <div className="relative h-40 w-64" aria-hidden>
              <div className="glass-card absolute inset-0 -rotate-6 translate-y-3 opacity-40" />
              <div className="glass-card absolute inset-0 rotate-3 translate-y-1.5 opacity-70" />
              <div className="glass-card shadow-glow absolute inset-0 flex items-center justify-center">
                <span className="text-4xl">🌍</span>
              </div>
            </div>
            <Link
              href="/play"
              className="shadow-glow flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-sm font-semibold text-white transition-transform active:scale-95"
            >
              <Play size={16} className="fill-white" />
              {t("home.tryDemo")}
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
