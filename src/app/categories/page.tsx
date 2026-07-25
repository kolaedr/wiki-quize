import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { LayoutGrid } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CatalogSearch } from "@/components/catalog-search";
import { FeedbackBlock } from "@/components/feedback/feedback-block";
import { GameIcon } from "@/components/game-icon";
import { db } from "@/db";
import { categories, games, topics } from "@/db/schema";
import { resolveText } from "@/i18n/locales";
import { categoryNodes } from "@/lib/deck/from-db";

export const dynamic = "force-dynamic";

/** All categories (even empty ones) + global search across games & categories. */
export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const locale = await getLocale();
  const t = await getTranslations();

  if (query) {
    const like = `%${query}%`;
    const [gameHits, catHits] = await Promise.all([
      db
        .select({
          slug: games.slug,
          title: games.title,
          style: games.style,
          catSlug: categories.slug,
          catTitle: categories.title,
        })
        .from(games)
        .innerJoin(topics, eq(topics.id, games.topicId))
        .leftJoin(categories, eq(categories.id, topics.categoryId))
        .where(
          and(
            eq(games.status, "published"),
            sql`(${games.title}->>'uk' ILIKE ${like} OR ${games.title}->>'en' ILIKE ${like} OR ${games.slug} ILIKE ${like})`,
          ),
        )
        .limit(40)
        .catch(() => []),
      db
        .select({ slug: categories.slug, title: categories.title, icon: categories.icon, image: categories.image })
        .from(categories)
        .where(sql`(${categories.title}->>'uk' ILIKE ${like} OR ${categories.title}->>'en' ILIKE ${like})`)
        .orderBy(asc(categories.sortOrder))
        .limit(20)
        .catch(() => []),
    ]);

    const nothing = gameHits.length === 0 && catHits.length === 0;

    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-4">
        <Breadcrumbs
          items={[{ href: "/categories", label: t("home.allCategories") }, { label: `«${query}»` }]}
        />
        <CatalogSearch initial={query} placeholder={t("home.searchPlaceholder")} />

        {catHits.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
              {t("home.categories")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {catHits.map((c) => (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  className="glass-card flex flex-col items-center gap-2 p-4 text-center transition-all hover:border-accent active:scale-[0.98]"
                >
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Commons thumb
                    <img src={c.image} alt="" className="h-14 w-[86%] rounded-lg object-contain" />
                  ) : (
                    <GameIcon name={c.icon ?? undefined} size={30} box="h-14 w-14" />
                  )}
                  <span className="font-semibold leading-tight">{resolveText(c.title, locale)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {gameHits.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
              {t("home.games")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gameHits.map((g) => (
                <Link
                  key={g.slug}
                  href={`/play/${g.slug}`}
                  className="glass-card flex flex-col items-center gap-2 p-4 text-center transition-all hover:border-accent active:scale-[0.98]"
                >
                  <GameIcon name={(g.style as { icon?: string })?.icon} size={30} box="h-14 w-14" />
                  <span className="font-semibold leading-tight">{resolveText(g.title, locale)}</span>
                  {g.catTitle && (
                    <span className="text-[11px] text-muted">{resolveText(g.catTitle, locale)}</span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {nothing && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t("home.nothingFound")}</p>
            <FeedbackBlock />
          </div>
        )}
      </main>
    );
  }

  // no query → TOP-LEVEL categories only (click drills into subcategories),
  // sorted by how many published games sit under the whole subtree.
  const nodes = await categoryNodes().catch(() => []);
  const cats = nodes
    .filter((c) => !c.parentId)
    .sort((a, b) => b.gamesCount - a.gamesCount);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-4">
      <Breadcrumbs items={[{ label: t("home.allCategories") }]} />
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <LayoutGrid size={22} /> {t("home.allCategories")}
      </h1>
      <CatalogSearch placeholder={t("home.searchPlaceholder")} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cats.map((c) => (
          <Link
            key={c.slug}
            href={`/category/${c.slug}`}
            className="glass-card flex flex-col items-center gap-2 p-4 text-center transition-all hover:border-accent active:scale-[0.98]"
          >
            {c.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- Commons thumb
              <img src={c.image} alt="" className="h-16 w-[86%] rounded-lg object-contain" />
            ) : (
              <GameIcon name={c.icon ?? undefined} size={32} box="h-16 w-16" />
            )}
            <span className="font-semibold leading-tight">{resolveText(c.title, locale)}</span>
            <span className={`text-xs ${c.gamesCount > 0 ? "text-muted" : "text-accent/70"}`}>
              {c.gamesCount > 0 ? t("home.gamesCount", { count: c.gamesCount }) : t("home.comingSoon")}
            </span>
          </Link>
        ))}
      </div>

      <FeedbackBlock />
    </main>
  );
}
