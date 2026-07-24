import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { ArrowLeft, ImageOff, Settings2, Wand2 } from "lucide-react";
import { db } from "@/db";
import { topicEntities, topics } from "@/db/schema";
import { ActionButton } from "@/components/admin/action-button";
import { DatasetSetup } from "@/components/admin/dataset-setup";
import { GameComposer } from "@/components/admin/game-composer";
import { ImportRunner } from "@/components/admin/import-runner";
import { ItemPreview } from "@/components/admin/item-preview";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { resolveText } from "@/i18n/locales";
import { importPresetAction, toggleEntityAction } from "@/lib/admin/actions";
import { proposeGamesForTopic } from "@/lib/admin/compose";
import { requireSuperPage } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";
const PAGE = 20;

/** Admin item browser: see every entity of a topic, switch items off/on. */
export default async function AdminTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await requireSuperPage();
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const [topic] = await db.select().from(topics).where(eq(topics.slug, slug)).limit(1);
  if (!topic) notFound();

  // draft = created but no class/fields yet → show the setup builder
  const sc = topic.sourceConfig as { def?: { fields?: unknown[] }; preset?: string } | null;
  const isDef = !!sc?.def?.fields?.length;
  const needsSetup = !sc?.preset && !isDef;

  const composed = needsSetup ? null : await proposeGamesForTopic(slug, "uk").catch(() => null);

  const [rows, [{ n: total }]] = await Promise.all([
    db
      .select()
      .from(topicEntities)
      .where(eq(topicEntities.topicId, topic.id))
      .orderBy(desc(topicEntities.difficultyScore), asc(topicEntities.wikidataQid))
      .limit(PAGE + 1)
      .offset((page - 1) * PAGE),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(topicEntities)
      .where(and(eq(topicEntities.topicId, topic.id), eq(topicEntities.excluded, true))),
  ]);
  const hasNext = rows.length > PAGE;
  const items = rows.slice(0, PAGE);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin/topics"
          className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={15} /> Датасети
        </Link>
        {!needsSetup && <Badge variant="muted">вимкнено: {total}</Badge>}
      </div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{resolveText(topic.title, "uk")}</h1>
        {!needsSetup &&
          (isDef ? (
            <ImportRunner topicSlug={slug} label="Синхронізувати з Wikidata" />
          ) : (
            <ActionButton
              variant="secondary"
              label="Синхронізувати з Wikidata"
              icon="sync"
              action={importPresetAction.bind(null, slug)}
            />
          ))}
      </div>

      {needsSetup ? (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">
            <Settings2 size={14} /> Налаштування датасету — знайди клас, зроби розвідку, познач поля
          </h2>
          <DatasetSetup topicSlug={slug} />
        </section>
      ) : (
        <>
          {/* pair composer: propose games from this dataset's fields */}
          <section className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">
              <Wand2 size={14} /> Можливі ігри
            </h2>
            <GameComposer topicSlug={slug} proposals={composed?.proposals ?? []} />
          </section>

          <h2 className="mt-2 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-muted">
            Айтеми
          </h2>

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
              fields={(topic.fieldSchema as { role: string; kind: string }[]) ?? []}
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
        </>
      )}
    </>
  );
}
