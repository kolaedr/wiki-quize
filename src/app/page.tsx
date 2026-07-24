import Link from "next/link";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Globe2, Play, UserPlus } from "lucide-react";
import { GameIcon } from "@/components/game-icon";
import { Button } from "@/components/ui/button";
import { resolveText } from "@/i18n/locales";
import { auth } from "@/lib/auth";
import { listCategories } from "@/lib/deck/from-db";

export const dynamic = "force-dynamic"; // categories come from the DB

/** Home = categories (topics); games live inside a category. */
export default async function Home() {
  const t = await getTranslations();
  const locale = await getLocale();
  const [categories, session] = await Promise.all([
    listCategories(),
    auth.api.getSession({ headers: await headers() }).catch(() => null),
  ]);

  return (
    <>
      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-display max-w-xs bg-gradient-to-br from-fg via-fg to-accent bg-clip-text text-3xl font-bold leading-tight tracking-tight text-transparent">
            {t("app.tagline")}
          </h1>
          <p className="max-w-sm text-balance text-sm leading-6 text-muted">
            {t("app.description")}
          </p>
        </div>

        {/* onboarding cards — only for guests; signed-in users go straight to categories */}
        {!session && (
          <section className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/play"
              className="glass-card flex flex-col gap-2 p-5 transition-all hover:border-accent active:scale-[0.99]"
            >
              <span className="flex items-center gap-2 font-display font-semibold">
                <Play size={16} className="text-accent" /> {t("home.heroPlayTitle")}
              </span>
              <span className="text-sm leading-6 text-muted">{t("home.heroPlayText")}</span>
              <span className="mt-1 flex items-center gap-1 text-sm font-medium text-accent">
                {t("home.heroPlayCta")} <ChevronRight size={15} />
              </span>
            </Link>
            <Link
              href="/auth"
              className="glass-card flex flex-col gap-2 p-5 transition-all hover:border-accent active:scale-[0.99]"
            >
              <span className="flex items-center gap-2 font-display font-semibold">
                <UserPlus size={16} className="text-accent" /> {t("home.heroJoinTitle")}
              </span>
              <span className="text-sm leading-6 text-muted">{t("home.heroJoinText")}</span>
              <span className="mt-1 flex items-center gap-1 text-sm font-medium text-accent">
                {t("home.heroJoinCta")} <ChevronRight size={15} />
              </span>
            </Link>
          </section>
        )}

        {categories.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-display px-1 text-sm font-semibold uppercase tracking-wide text-muted">
              {t("home.categories")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="glass-card flex items-center gap-4 p-4 transition-all hover:border-accent active:scale-[0.99]"
              >
                <GameIcon name={c.icon} />
                <span className="flex flex-1 flex-col">
                  <span className="font-semibold">{resolveText(c.title, locale)}</span>
                  <span className="text-xs text-muted">
                    {t("home.gamesCount", { count: c.gamesCount })}
                  </span>
                </span>
                <ChevronRight size={18} className="text-muted" />
              </Link>
            ))}
            </div>
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
            <Button asChild size="lg">
              <Link href="/play">
                <Play size={16} className="fill-white" />
                {t("home.tryDemo")}
              </Link>
            </Button>
          </div>
        )}
      </main>
    </>
  );
}
