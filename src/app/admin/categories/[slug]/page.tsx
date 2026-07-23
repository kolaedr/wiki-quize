import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { ArrowLeft, ChevronRight, Database, FolderTree } from "lucide-react";
import { db } from "@/db";
import { categories, games, topics } from "@/db/schema";
import { GameIcon } from "@/components/game-icon";
import {
  AttachDatasetSelect,
  CategorySelect,
  NewCategoryForm,
  TogglePanel,
  type CategoryOption,
} from "@/components/admin/category-controls";
import { NewTopicForm } from "@/components/admin/new-topic-form";
import { Badge } from "@/components/ui/badge";
import { resolveText } from "@/i18n/locales";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // creating a dataset runs an import

/** Category detail: sub-categories, its datasets, add/attach controls. */
export default async function AdminCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [cat] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  if (!cat) notFound();

  const [allCats, myTopics, freeTopics, gameCounts] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(topics).where(eq(topics.categoryId, cat.id)),
    // candidates to attach: datasets in NO category or in a DIFFERENT one
    db
      .select({ slug: topics.slug, title: topics.title })
      .from(topics)
      .where(or(isNull(topics.categoryId), ne(topics.categoryId, cat.id))),
    db
      .select({ topicId: games.topicId, n: sql<number>`count(*)::int` })
      .from(games)
      .groupBy(games.topicId),
  ]);
  const gamesByTopic = new Map(gameCounts.map((g) => [g.topicId, g.n]));
  const options: CategoryOption[] = allCats.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: resolveText(c.title, "uk"),
  }));
  const children = allCats.filter((c) => c.parentId === cat.id);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin/categories"
          className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={15} /> Категорії
        </Link>
      </div>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <GameIcon name={cat.icon ?? undefined} size={24} />
        {resolveText(cat.title, "uk")}
      </h1>

      {/* sub-categories */}
      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">
          <FolderTree size={14} /> Підкатегорії
        </h2>
        {children.length === 0 && <p className="text-sm text-muted">Немає підкатегорій.</p>}
        {children.map((c) => (
          <Link
            key={c.id}
            href={`/admin/categories/${c.slug}`}
            className="glass-card flex items-center gap-3 p-3 transition-colors hover:border-accent/60"
          >
            <GameIcon name={c.icon ?? undefined} size={16} />
            <span className="flex-1 font-semibold">{resolveText(c.title, "uk")}</span>
            <ChevronRight size={16} className="text-muted" />
          </Link>
        ))}
        <TogglePanel label="Додати підкатегорію">
          <NewCategoryForm presetParentId={cat.id} />
        </TogglePanel>
      </section>

      {/* datasets of this category */}
      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">
          <Database size={14} /> Датасети категорії
        </h2>
        {myTopics.length === 0 && (
          <p className="text-sm text-muted">Ще немає датасетів у цій категорії.</p>
        )}
        {myTopics.map((t) => (
          <div key={t.id} className="glass-card flex items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-3">
              <GameIcon name={(t.sourceConfig as { icon?: string })?.icon} size={16} />
              <div>
                <p className="font-semibold">{resolveText(t.title, "uk")}</p>
                <p className="text-[11px] text-muted">
                  {t.status} · ігор: {gamesByTopic.get(t.id) ?? 0}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="muted">/{t.slug}</Badge>
              {/* change/detach category */}
              <CategorySelect topicSlug={t.slug} categoryId={t.categoryId} options={options} />
            </div>
          </div>
        ))}

        <AttachDatasetSelect
          categoryId={cat.id}
          candidates={freeTopics.map((t) => ({ slug: t.slug, title: resolveText(t.title, "uk") }))}
        />

        <TogglePanel label="Додати датасет (новий, з Wikidata)">
          <NewTopicForm categoryId={cat.id} />
        </TogglePanel>
      </section>
    </>
  );
}
