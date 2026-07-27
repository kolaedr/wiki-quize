import Link from "next/link";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Gamepad2, Globe2, HelpCircle, Play, UserPlus } from "lucide-react";
import { CategoryThumb } from "@/components/category-thumb";
import { FeedbackBlock } from "@/components/feedback/feedback-block";
import { InstallAppBlock } from "@/components/install-app-block";
import { Button } from "@/components/ui/button";
import { resolveText } from "@/i18n/locales";
import { auth } from "@/lib/auth";
import { getContentStats, listCategories } from "@/lib/deck/from-db";

/** How many categories the home grid shows (2 cols mobile / 4 desktop). */
const HOME_CATEGORIES = 8;

export const dynamic = "force-dynamic"; // categories come from the DB

/** Home = categories (topics); games live inside a category. */
export default async function Home() {
  const t = await getTranslations();
  const locale = await getLocale();
  const [categories, stats, session] = await Promise.all([
    listCategories(),
    getContentStats(),
    auth.api.getSession({ headers: await headers() }).catch(() => null),
  ]);
  const nf = new Intl.NumberFormat(locale);

  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-display max-w-xs bg-gradient-to-br from-fg via-fg to-accent bg-clip-text text-3xl font-bold leading-tight tracking-tight text-transparent">
            {t("app.tagline")}
          </h1>
          <p className="max-w-sm text-balance text-sm leading-6 text-muted">
            {t("app.description")}
          </p>
        </div>

        {/* onboarding as a hand of two playing cards — a taste of the game itself.
            Only for guests; signed-in users go straight to categories. */}
        {!session && (
          <section className="flex items-stretch justify-center gap-2 py-1 sm:gap-4">
            <Link
              href="/play"
              className="group glass-card relative flex aspect-[5/7] w-40 -rotate-[7deg] flex-col justify-between p-4 shadow-xl transition-all hover:z-10 hover:-translate-y-2 hover:rotate-0 hover:border-accent active:scale-95 sm:w-48"
              style={{ transformOrigin: "bottom center" }}
            >
              <span className="absolute right-3 top-2.5 font-display text-xs font-bold text-muted">A</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Play size={20} />
              </span>
              <div className="flex flex-col gap-1">
                <span className="font-display font-bold leading-tight">{t("home.heroPlayTitle")}</span>
                <span className="text-[11px] leading-4 text-muted">{t("home.heroPlayText")}</span>
              </div>
              <span className="flex items-center gap-1 text-sm font-medium text-accent">
                {t("home.heroPlayCta")} <ChevronRight size={15} />
              </span>
            </Link>
            <Link
              href="/auth"
              className="group glass-card relative flex aspect-[5/7] w-40 rotate-[7deg] flex-col justify-between p-4 shadow-xl transition-all hover:z-10 hover:-translate-y-2 hover:rotate-0 hover:border-accent active:scale-95 sm:w-48"
              style={{ transformOrigin: "bottom center" }}
            >
              <span className="absolute right-3 top-2.5 font-display text-xs font-bold text-muted">B</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <UserPlus size={20} />
              </span>
              <div className="flex flex-col gap-1">
                <span className="font-display font-bold leading-tight">{t("home.heroJoinTitle")}</span>
                <span className="text-[11px] leading-4 text-muted">{t("home.heroJoinText")}</span>
              </div>
              <span className="flex items-center gap-1 text-sm font-medium text-accent">
                {t("home.heroJoinCta")} <ChevronRight size={15} />
              </span>
            </Link>
          </section>
        )}

        {categories.length > 0 ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
                {t("home.categories")}
              </h2>
              <Link href="/categories" className="text-xs font-medium text-accent hover:underline">
                {t("home.allCategories")}
              </Link>
            </div>
            {/* fixed grid of the top categories by game count — 2 cols on phones,
                4 on desktop. "All categories" stays in the header link above. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[...categories]
                .sort((a, b) => b.gamesCount - a.gamesCount)
                .slice(0, HOME_CATEGORIES)
                .map((c) => (
                  <Link
                    key={c.slug}
                    href={`/category/${c.slug}`}
                    className="glass-card flex flex-col overflow-hidden transition-all hover:border-accent active:scale-[0.98]"
                  >
                    <CategoryThumb image={c.image} icon={c.icon} />
                    <div className="flex flex-1 flex-col gap-0.5 p-3">
                      <span className="line-clamp-2 font-semibold leading-tight">
                        {resolveText(c.title, locale)}
                      </span>
                      <span className="text-xs text-muted">
                        {t("home.gamesCount", { count: c.gamesCount })}
                      </span>
                    </div>
                  </Link>
                ))}
            </div>

            {/* slim stats bar: how much there actually is to play right now */}
            {(stats.items > 0 || stats.games > 0) && (
              <div className="glass-card flex items-center justify-center gap-4 px-4 py-2.5 text-xs sm:gap-6">
                <span className="flex items-center gap-1.5">
                  <HelpCircle size={14} className="shrink-0 text-accent" />
                  <span className="font-semibold text-fg">{nf.format(stats.items)}</span>
                  <span className="text-muted">{t("home.statsQuestions")}</span>
                </span>
                <span className="h-4 w-px bg-line" aria-hidden />
                <span className="flex items-center gap-1.5">
                  <Gamepad2 size={14} className="shrink-0 text-accent" />
                  <span className="font-semibold text-fg">{nf.format(stats.games)}</span>
                  <span className="text-muted">{t("home.statsGames")}</span>
                </span>
              </div>
            )}
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

        <FeedbackBlock />

        <InstallAppBlock />
      </main>
    </>
  );
}
