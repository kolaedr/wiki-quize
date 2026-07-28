import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GameIcon } from "@/components/game-icon";
import { GameTitleEditButton } from "@/components/admin/game-title-edit-button";
import { Pagination } from "@/components/pagination";
import { resolveText } from "@/i18n/locales";
import { getStaff } from "@/lib/admin/guard";
import { loadCategoryPage } from "@/lib/deck/from-db";
import { imageFrame } from "@/lib/image-frame";

export const dynamic = "force-dynamic";

/** Category page: paginated list of the topic's published games. */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const locale = await getLocale();
  const t = await getTranslations();

  let data;
  try {
    data = await loadCategoryPage(slug, page);
  } catch {
    data = null;
  }
  if (!data) notFound();

  // staff (super or moderator) get an inline rename pencil on each card —
  // the page is force-dynamic, so this is evaluated per request
  const canEdit = !!(await getStaff());

  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-4">
        <Breadcrumbs items={[{ label: resolveText(data.title, locale) }]} />
        <div className="flex items-center gap-3">
          {data.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- Commons thumb
            <img src={data.image} alt="" className={`h-12 w-16 object-contain ${imageFrame()}`} />
          ) : (
            <GameIcon name={data.icon} size={28} />
          )}
          <h1 className="font-display text-2xl font-bold">
            {resolveText(data.title, locale)}
          </h1>
        </div>

        {/* subcategories — drill down into nesting before/above the games */}
        {data.children.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.children.map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="glass-card flex flex-col items-center gap-2 p-4 text-center transition-all hover:border-accent active:scale-[0.98]"
              >
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Commons thumb
                  <img src={c.image} alt="" className={`h-14 w-[86%] object-contain ${imageFrame()}`} />
                ) : (
                  <GameIcon name={c.icon} size={30} box="h-14 w-14" />
                )}
                <span className="font-semibold leading-tight">{resolveText(c.title, locale)}</span>
                <span className={`text-xs ${c.gamesCount > 0 ? "text-muted" : "text-accent/70"}`}>
                  {c.gamesCount > 0
                    ? t("home.gamesCount", { count: c.gamesCount })
                    : t("home.comingSoon")}
                </span>
              </Link>
            ))}
          </div>
        )}

        {data.items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.items.map((g) => (
          <div key={g.slug} className="relative">
          <Link
            href={`/play/${g.slug}`}
            className="glass-card flex h-full flex-col items-center gap-2.5 p-3 text-center transition-all hover:border-accent active:scale-[0.98]"
          >
            {(g.style as { cover?: string })?.cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- Commons thumb
              <img
                src={(g.style as { cover?: string }).cover}
                alt=""
                className={`h-20 w-[90%] object-contain ${imageFrame()}`}
              />
            ) : (
              <GameIcon name={(g.style as { icon?: string })?.icon} size={32} box="h-16 w-16" />
            )}
            <span className="font-semibold leading-tight">{resolveText(g.title, locale)}</span>
            <span className="text-xs text-muted">
              {t("levels.count", { levels: g.config.levels })}
            </span>
          </Link>
          {canEdit && (
            <GameTitleEditButton
              slug={g.slug}
              title={g.title}
              className="absolute right-1.5 top-1.5"
            />
          )}
          </div>
        ))}
        </div>
        )}

        <Pagination
          page={data.page}
          hasNext={data.hasNext}
          makeHref={(p) => `/category/${slug}?page=${p}`}
        />
      </main>
    </>
  );
}
