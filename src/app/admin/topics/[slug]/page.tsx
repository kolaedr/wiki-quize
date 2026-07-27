import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { ArrowLeft, ImageOff, Settings2 } from "lucide-react";
import { db } from "@/db";
import { games, topicEntities, topics } from "@/db/schema";
import { ActionButton } from "@/components/admin/action-button";
import { DatasetSetup } from "@/components/admin/dataset-setup";
import { GameAdminCard } from "@/components/admin/game-admin-card";
import { ImportRunner } from "@/components/admin/import-runner";
import { ItemPreview } from "@/components/admin/item-preview";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { resolveText } from "@/i18n/locales";
import { importPresetAction, toggleEntityAction } from "@/lib/admin/actions";
import { requireSuperPage } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";
const PAGE = 20;

/** Admin dataset page: tabs — items browser + the (already generated) games. */
export default async function AdminTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; tab?: string }>;
}) {
  await requireSuperPage();
  const { slug } = await params;
  const { page: pageParam, tab: tabParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const tab = tabParam === "games" ? "games" : tabParam === "sync" ? "sync" : "items";

  const [topic] = await db.select().from(topics).where(eq(topics.slug, slug)).limit(1);
  if (!topic) notFound();

  // draft = created but no class/fields yet → show the setup builder
  const sc = topic.sourceConfig as { def?: { fields?: unknown[] }; preset?: string } | null;
  const isDef = !!sc?.def?.fields?.length;
  const needsSetup = !sc?.preset && !isDef;

  if (needsSetup) {
    return (
      <>
        <TopicHeader title={resolveText(topic.title, "uk")} sync={null} off={null} />
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">
            <Settings2 size={14} /> Налаштування датасету — знайди клас, зроби розвідку, познач поля
          </h2>
          <DatasetSetup topicSlug={slug} />
        </section>
      </>
    );
  }

  // ONE query per list — items (paged) + counts + games (with this topic's schema)
  const [rows, [{ n: off }], [{ n: itemsTotal }], gameRows] = await Promise.all([
    tab === "items"
      ? db
          .select()
          .from(topicEntities)
          .where(eq(topicEntities.topicId, topic.id))
          .orderBy(desc(topicEntities.difficultyScore), asc(topicEntities.wikidataQid))
          .limit(PAGE + 1)
          .offset((page - 1) * PAGE)
      : Promise.resolve([]),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(topicEntities)
      .where(and(eq(topicEntities.topicId, topic.id), eq(topicEntities.excluded, true))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(topicEntities)
      .where(eq(topicEntities.topicId, topic.id)),
    db
      .select({ game: games })
      .from(games)
      .where(eq(games.topicId, topic.id))
      .orderBy(desc(games.playsCount), games.slug),
  ]);
  const hasNext = rows.length > PAGE;
  const items = rows.slice(0, PAGE);
  const fieldSchema = (topic.fieldSchema ?? []) as { role: string; kind: string }[];

  const sync = isDef ? (
    <ImportRunner topicSlug={slug} label="Синхронізувати з Wikidata" />
  ) : (
    <ActionButton
      variant="secondary"
      label="Синхронізувати з Wikidata"
      icon="sync"
      action={importPresetAction.bind(null, slug)}
    />
  );

  const tabLink = (key: "items" | "games" | "sync", label: string) => (
    <Link
      href={key === "items" ? `/admin/topics/${slug}` : `/admin/topics/${slug}?tab=${key}`}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        tab === key
          ? "border-accent text-accent"
          : "border-transparent text-muted hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <TopicHeader title={resolveText(topic.title, "uk")} sync={null} off={off} />

      <div className="flex gap-1 border-b border-line/60">
        {tabLink("items", `Айтеми (${itemsTotal})`)}
        {tabLink("games", `Ігри (${gameRows.length})`)}
        {tabLink("sync", "Синхронізація")}
      </div>

      {tab === "sync" ? (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">
            <Settings2 size={14} /> Синхронізація з Wikidata
          </h2>
          {sync}
        </section>
      ) : tab === "games" ? (
        <section className="flex flex-col gap-3">
          {gameRows.length === 0 && (
            <p className="text-sm text-muted">
              Ігри створюються автоматично після синхронізації (як unlisted). Опублікуй їх тут.
            </p>
          )}
          {gameRows.map(({ game }) => (
            <GameAdminCard key={game.id} game={game} fieldSchema={fieldSchema} />
          ))}
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          {items.map((e) => {
            const label =
              (e.labels as Record<string, string>).uk ?? (e.labels as Record<string, string>).en;
            return (
              <div
                key={e.id}
                className={`glass-card flex items-center gap-3 p-3 ${e.excluded ? "opacity-50" : ""}`}
              >
                {e.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Commons thumb
                  <img src={e.imageUrl} alt="" className="h-10 w-14 rounded object-contain" />
                ) : (
                  <span className="flex h-10 w-14 items-center justify-center rounded bg-accent-soft">
                    <ImageOff size={14} className="text-muted" />
                  </span>
                )}
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-[11px] text-muted">
                    {e.wikidataQid} · sitelinks {e.sitelinks} · складність{" "}
                    {Math.round((e.difficultyScore ?? 0) * 100)}%
                  </span>
                </span>
                {e.excluded && <Badge variant="danger">вимкнено</Badge>}
                <ItemPreview
                  entity={{
                    qid: e.wikidataQid,
                    label,
                    imageUrl: e.imageUrl,
                    values: e.values as Record<string, unknown>,
                    wikiLinks: e.wikiLinks as Record<string, string> | null,
                  }}
                  fields={fieldSchema}
                />
                <ActionButton
                  variant="ghost"
                  label={e.excluded ? "Увімкнути" : "Вимкнути"}
                  action={toggleEntityAction.bind(null, e.id)}
                />
              </div>
            );
          })}
          <Pagination
            page={page}
            hasNext={hasNext}
            makeHref={(p) => `/admin/topics/${slug}?page=${p}`}
          />
        </section>
      )}
    </>
  );
}

function TopicHeader({
  title,
  sync,
  off,
}: {
  title: string;
  sync: React.ReactNode;
  off: number | null;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin/topics"
          className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={15} /> Датасети
        </Link>
        {off != null && <Badge variant="muted">вимкнено: {off}</Badge>}
      </div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {sync}
      </div>
    </>
  );
}
