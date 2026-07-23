import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GameIcon } from "@/components/game-icon";
import { Pagination } from "@/components/pagination";
import { resolveText } from "@/i18n/locales";
import { listGamesByTopic } from "@/lib/deck/from-db";

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
    data = await listGamesByTopic(slug, page);
  } catch {
    data = null;
  }
  if (!data) notFound();

  return (
    <>
      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <Breadcrumbs items={[{ label: resolveText(data.topic.title, locale) }]} />
        <div className="flex items-center gap-3">
          <GameIcon name={(data.topic.sourceConfig as { icon?: string })?.icon} size={28} />
          <h1 className="font-display text-2xl font-bold">
            {resolveText(data.topic.title, locale)}
          </h1>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
        {data.items.map((g) => (
          <Link
            key={g.slug}
            href={`/play/${g.slug}`}
            className="glass-card flex items-center gap-4 p-4 transition-all hover:border-accent active:scale-[0.99]"
          >
            <GameIcon name={(g.style as { icon?: string })?.icon} />
            <span className="flex flex-1 flex-col">
              <span className="font-semibold">{resolveText(g.title, locale)}</span>
              <span className="text-xs text-muted">
                {t("levels.count", { levels: g.config.levels })}
              </span>
            </span>
            <ChevronRight size={18} className="text-muted" />
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
