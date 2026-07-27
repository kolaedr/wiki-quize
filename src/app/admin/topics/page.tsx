import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Database, RefreshCw, Rows3, Settings2 } from "lucide-react";
import { db } from "@/db";
import { categories, games, topicEntities, topics } from "@/db/schema";
import { resolveText } from "@/i18n/locales";
import { deleteTopicAction, importPresetAction, resetContentAction } from "@/lib/admin/actions";
import { PRESETS } from "@/lib/ingest/presets";
import { ActionButton } from "@/components/admin/action-button";
import { CategorySelect } from "@/components/admin/category-controls";
import { DatasetSetup } from "@/components/admin/dataset-setup";
import { TopicsFilter } from "@/components/admin/topics-filter";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSuperPage } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // legacy preset imports still run inline here

const PAGE = 20;
const STATUSES = ["draft", "syncing", "ready", "published", "disabled"] as const;

/**
 * Datasets INDEX — paginated + searchable list, nothing more.
 *
 * Deliberately dumb rows: no import runner, no per-row client component that
 * hits the server on mount. Everything a row needs comes from three fixed
 * queries (page of topics + one grouped count per list), so the request count
 * is constant no matter how many datasets exist. Sync/progress lives on the
 * dataset page (`/admin/topics/[slug]?tab=sync`).
 */
export default async function AdminTopicsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  await requireSuperPage();
  const { page: pageParam, q: qParam, status: statusParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const q = (qParam ?? "").trim();
  const status = STATUSES.includes(statusParam as (typeof STATUSES)[number])
    ? (statusParam as (typeof STATUSES)[number])
    : null;

  // search matches slug OR any localised title (jsonb → text is enough here)
  const where = and(
    q
      ? or(ilike(topics.slug, `%${q}%`), sql`${topics.title}::text ilike ${`%${q}%`}`)
      : undefined,
    status ? eq(topics.status, status) : undefined,
  );

  // QUERY 1 — one page of datasets, explicit columns only (no big jsonb blobs;
  // `configured` is computed in SQL instead of shipping sourceConfig over).
  const rows = await db
    .select({
      id: topics.id,
      slug: topics.slug,
      title: topics.title,
      status: topics.status,
      categoryId: topics.categoryId,
      syncedAt: topics.syncedAt,
      configured: sql<boolean>`(
        ${topics.sourceConfig}->'preset' is not null
        or (
          jsonb_typeof(${topics.sourceConfig}->'def'->'fields') = 'array'
          and jsonb_array_length(${topics.sourceConfig}->'def'->'fields') > 0
        )
      )`,
    })
    .from(topics)
    .where(where)
    .orderBy(desc(topics.createdAt))
    .limit(PAGE + 1)
    .offset((page - 1) * PAGE)
    .catch(() => []);

  const hasNext = rows.length > PAGE;
  const pageRows = rows.slice(0, PAGE);
  const ids = pageRows.map((t) => t.id);

  // QUERIES 2–4 — aggregates for THIS PAGE only, one grouped query each.
  const [entityCounts, gameCounts, categoryRows] = await Promise.all([
    ids.length
      ? db
          .select({ topicId: topicEntities.topicId, n: sql<number>`count(*)::int` })
          .from(topicEntities)
          .where(inArray(topicEntities.topicId, ids))
          .groupBy(topicEntities.topicId)
          .catch(() => [])
      : Promise.resolve([]),
    ids.length
      ? db
          .select({ topicId: games.topicId, n: sql<number>`count(*)::int` })
          .from(games)
          .where(inArray(games.topicId, ids))
          .groupBy(games.topicId)
          .catch(() => [])
      : Promise.resolve([]),
    db.select().from(categories).orderBy(asc(categories.sortOrder)).catch(() => []),
  ]);

  const entityByTopic = new Map(entityCounts.map((c) => [c.topicId, c.n]));
  const gamesByTopic = new Map(gameCounts.map((c) => [c.topicId, c.n]));
  const categoryOptions = categoryRows.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: resolveText(c.title, "uk"),
  }));

  // legacy presets that were never imported — only on a clean first page
  const knownSlugs = new Set(pageRows.map((t) => t.slug));
  const missingPresets =
    page === 1 && !q && !status
      ? Object.values(PRESETS).filter((p) => !knownSlugs.has(p.slug))
      : [];

  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (status) s.set("status", status);
    if (p > 1) s.set("page", String(p));
    return `/admin/topics${s.toString() ? `?${s.toString()}` : ""}`;
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Database size={20} /> Датасети
        </h1>
        <ActionButton
          variant="ghost"
          confirm
          icon="trash"
          label="Очистити датасети й ігри"
          action={resetContentAction}
        />
      </div>

      <TopicsFilter q={q} status={status ?? "all"} />

      <section className="flex flex-col gap-2">
        {pageRows.length === 0 && (
          <p className="text-sm text-muted">
            {q || status ? "Нічого не знайдено." : "Датасетів ще немає."}
          </p>
        )}

        {pageRows.map((t) => (
          <div key={t.id} className="glass-card flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/topics/${t.slug}`}
                className="font-semibold transition-colors hover:text-accent"
              >
                {resolveText(t.title, "uk")}
              </Link>
              <p className="truncate text-xs text-muted">
                {t.slug} · {entityByTopic.get(t.id) ?? 0} сутностей ·{" "}
                {gamesByTopic.get(t.id) ?? 0} ігор · синк:{" "}
                {t.syncedAt ? new Date(t.syncedAt).toLocaleDateString("uk-UA") : "—"}
              </p>
            </div>

            {!t.configured && <Badge variant="muted">не налаштовано</Badge>}
            <Badge variant={t.status === "published" ? "success" : "muted"}>{t.status}</Badge>

            <CategorySelect topicSlug={t.slug} categoryId={t.categoryId} options={categoryOptions} />

            <Button asChild size="sm" variant="ghost">
              <Link href={`/admin/topics/${t.slug}`}>
                {t.configured ? <Rows3 size={13} /> : <Settings2 size={13} />}
                {t.configured ? "Айтеми" : "Налаштувати"}
              </Link>
            </Button>

            {t.configured && (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/admin/topics/${t.slug}?tab=sync`}>
                  <RefreshCw size={13} /> Синк
                </Link>
              </Button>
            )}

            <ActionButton
              variant="ghost"
              confirm
              iconOnly
              icon="trash"
              label="Видалити датасет"
              action={deleteTopicAction.bind(null, t.slug)}
            />
          </div>
        ))}

        <Pagination page={page} hasNext={hasNext} makeHref={href} />
      </section>

      {missingPresets.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
            Legacy-пресети (ще не імпортовані)
          </h2>
          {missingPresets.map((p) => (
            <div key={p.slug} className="glass-card flex items-center justify-between gap-3 p-3">
              <div>
                <p className="font-semibold">{resolveText(p.title, "uk")}</p>
                <p className="text-xs text-muted">{p.slug} · ще не імпортовано</p>
              </div>
              <ActionButton label="Імпортувати" action={importPresetAction.bind(null, p.key)} />
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
          Новий датасет
        </h2>
        <DatasetSetup categoryOptions={categoryOptions.map((c) => ({ id: c.id, title: c.title }))} />
      </section>
    </>
  );
}
