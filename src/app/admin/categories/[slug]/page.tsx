import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { ArrowLeft, ChevronRight, Database, FolderTree, Gamepad2 } from "lucide-react";
import { db } from "@/db";
import { categories, games, topics } from "@/db/schema";
import { GameIcon } from "@/components/game-icon";
import {
  AttachDatasetSelect,
  CategoryParentSelect,
  CategorySelect,
  NewCategoryForm,
  TogglePanel,
  type CategoryOption,
} from "@/components/admin/category-controls";
import { ActionButton } from "@/components/admin/action-button";
import { DraftDatasetForm } from "@/components/admin/draft-dataset-form";
import { GameAdminCard } from "@/components/admin/game-admin-card";
import { ItemImagePicker } from "@/components/admin/item-image-picker";
import { Badge } from "@/components/ui/badge";
import {
  deleteCategoryAction,
  listCategoryItemImagesAction,
  setCategoryImageAction,
} from "@/lib/admin/actions";
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

  // games across all datasets of this category (full editor card, like /admin/games)
  const topicIds = myTopics.map((t) => t.id);
  const catGames = topicIds.length
    ? await db
        .select({ game: games, fieldSchema: topics.fieldSchema })
        .from(games)
        .innerJoin(topics, eq(topics.id, games.topicId))
        .where(inArray(games.topicId, topicIds))
        .orderBy(desc(games.playsCount), games.slug)
    : [];

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <GameIcon name={cat.icon ?? undefined} size={24} />
          {resolveText(cat.title, "uk")}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <CategoryParentSelect
            slug={cat.slug}
            currentParentId={cat.parentId}
            options={options.filter((o) => o.slug !== cat.slug)}
          />
          <ActionButton
            variant="ghost"
            confirm
            icon="trash"
            iconOnly
            label="Видалити категорію"
            action={deleteCategoryAction.bind(null, cat.slug)}
          />
        </div>
      </div>

      {/* category image, picked from items across its datasets */}
      <ItemImagePicker
        label="Зображення категорії"
        hint="Показується на картці категорії в каталозі (замість іконки)."
        initial={cat.image ?? undefined}
        load={listCategoryItemImagesAction.bind(null, cat.slug)}
        save={setCategoryImageAction.bind(null, cat.slug)}
      />

      {/* scrape helpers stored on the category */}
      {(() => {
        const meta = cat.meta as { classHints?: string[]; note?: string } | null;
        if (!meta?.classHints?.length && !meta?.note) return null;
        return (
          <div className="glass-card flex flex-col gap-1 p-3 text-xs">
            {meta.classHints?.length ? (
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-muted">Підказки для розвідки:</span>
                {meta.classHints.map((h) => (
                  <span key={h} className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
                    {h}
                  </span>
                ))}
              </p>
            ) : null}
            {meta.note && <p className="text-[11px] text-muted">{meta.note}</p>}
          </div>
        );
      })()}

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
            <Link
              href={`/admin/topics/${t.slug}`}
              className="flex flex-1 items-center gap-3 transition-colors hover:text-accent"
            >
              <GameIcon name={(t.sourceConfig as { icon?: string })?.icon} size={16} />
              <div>
                <p className="font-semibold">{resolveText(t.title, "uk")}</p>
                <p className="text-[11px] text-muted">
                  {t.status} · ігор: {gamesByTopic.get(t.id) ?? 0} · відкрити →
                </p>
              </div>
            </Link>
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
          <DraftDatasetForm categoryId={cat.id} />
        </TogglePanel>
      </section>

      {/* games across this category's datasets */}
      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">
          <Gamepad2 size={14} /> Ігри категорії ({catGames.length})
        </h2>
        {catGames.length === 0 && (
          <p className="text-sm text-muted">Ще немає ігор у датасетах цієї категорії.</p>
        )}
        {catGames.map((row) => (
          <GameAdminCard
            key={row.game.id}
            game={row.game}
            fieldSchema={(row.fieldSchema ?? []) as { role: string; kind: string }[]}
          />
        ))}
      </section>
    </>
  );
}
