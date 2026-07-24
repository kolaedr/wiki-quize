import Link from "next/link";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Globe2, LayoutGrid, Play, UserPlus } from "lucide-react";
import { GameIcon } from "@/components/game-icon";
import { FeedbackBlock } from "@/components/feedback/feedback-block";
import { InstallAppBlock } from "@/components/install-app-block";
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
            {/* horizontal swiper: top categories by game count + an "all" card */}
            <div
              className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              data-scrollable
            >
              {[...categories]
                .sort((a, b) => b.gamesCount - a.gamesCount)
                .slice(0, 10)
                .map((c) => (
                  <Link
                    key={c.slug}
                    href={`/category/${c.slug}`}
                    className="glass-card flex w-36 shrink-0 snap-start flex-col items-center gap-2 p-4 text-center transition-all hover:border-accent active:scale-[0.98]"
                  >
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Commons thumb
                      <img src={c.image} alt="" className="h-16 w-[86%] rounded-lg object-contain" />
                    ) : (
                      <GameIcon name={c.icon} size={30} box="h-16 w-16" />
                    )}
                    <span className="font-semibold leading-tight">{resolveText(c.title, locale)}</span>
                    <span className="text-xs text-muted">
                      {t("home.gamesCount", { count: c.gamesCount })}
                    </span>
                  </Link>
                ))}
              <Link
                href="/categories"
                className="glass-card flex w-36 shrink-0 snap-start flex-col items-center justify-center gap-2 p-4 text-center text-accent transition-all hover:border-accent active:scale-[0.98]"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-accent-soft">
                  <LayoutGrid size={28} />
                </span>
                <span className="font-semibold leading-tight">{t("home.allCategories")}</span>
                <ChevronRight size={15} />
              </Link>
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

        <FeedbackBlock />

        <InstallAppBlock />
      </main>
    </>
  );
}
