import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GameIcon } from "@/components/game-icon";
import { Pagination } from "@/components/pagination";
import { resolveText } from "@/i18n/locales";
import { loadCategoryPage } from "@/lib/deck/from-db";

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

  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-4">
        <Breadcrumbs items={[{ label: resolveText(data.title, locale) }]} />
        <div className="flex items-center gap-3">
          {data.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- Commons thumb
            <img src={data.image} alt="" className="h-12 w-16 rounded-lg object-contain" />
          ) : (
            <GameIcon name={data.icon} size={28} />
          )}
          <h1 className="font-display text-2xl font-bold">
            {resolveText(data.title, locale)}
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.items.map((g) => (
          <Link
            key={g.slug}
            href={`/play/${g.slug}`}
            className="glass-card flex flex-col items-center gap-2.5 p-3 text-center transition-all hover:border-accent active:scale-[0.98]"
          >
            {(g.style as { cover?: string })?.cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- Commons thumb
              <img
                src={(g.style as { cover?: string }).cover}
                alt=""
                className="h-20 w-[90%] rounded-lg object-contain"
              />
            ) : (
              <GameIcon name={(g.style as { icon?: string })?.icon} size={32} box="h-16 w-16" />
            )}
            <span className="font-semibold leading-tight">{resolveText(g.title, locale)}</span>
            <span className="text-xs text-muted">
              {t("levels.count", { levels: g.config.levels })}
            </span>
          </Link>
        ))}
        </div>

        <Pagination
          page={data.page}
          hasNext={data.hasNext}
          makeHref={(p) => `/category/${slug}?page=${p}`}
        />
      </main>
    </>
  );
}
