import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Globe2, Play, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserButton } from "@/components/auth/user-button";
import { GameIcon } from "@/components/game-icon";
import { resolveText } from "@/i18n/locales";
import { getAdminSession } from "@/lib/admin/guard";
import { listCategories } from "@/lib/deck/from-db";

export const dynamic = "force-dynamic"; // categories come from the DB

/** Home = categories (topics); games live inside a category. */
export default async function Home() {
  const t = await getTranslations();
  const locale = await getLocale();
  const [categories, adminSession] = await Promise.all([
    listCategories(),
    getAdminSession(),
  ]);

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-4">
        <span className="font-display text-lg font-semibold tracking-tight">
          {t("app.name")}
        </span>
        <div className="flex items-center gap-2">
          {adminSession && (
            <Link
              href="/admin"
              title="Admin"
              className="glass-card flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-accent"
            >
              <Shield size={17} />
            </Link>
          )}
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

        {categories.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-display px-1 text-sm font-semibold uppercase tracking-wide text-muted">
              {t("home.categories")}
            </h2>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="glass-card flex items-center gap-4 p-4 transition-all hover:border-accent active:scale-[0.99]"
              >
                <GameIcon name={(c.sourceConfig as { icon?: string })?.icon} />
                <span className="flex flex-1 flex-col">
                  <span className="font-semibold">{resolveText(c.title, locale)}</span>
                  <span className="text-xs text-muted">
                    {t("home.gamesCount", { count: c.gamesCount })}
                  </span>
                </span>
                <ChevronRight size={18} className="text-muted" />
              </Link>
            ))}
          </section>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {/* Teaser while the DB is empty (run npm run db:seed) */}
            <div className="relative h-40 w-64" aria-hidden>
              <div className="glass-card absolute inset-0 -rotate-6 translate-y-3 opacity-40" />
              <div className="glass-card absolute inset-0 rotate-3 translate-y-1.5 opacity-70" />
              <div className="glass-card shadow-glow absolute inset-0 flex items-center justify-center">
                <Globe2 size={40} className="text-accent" />
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
