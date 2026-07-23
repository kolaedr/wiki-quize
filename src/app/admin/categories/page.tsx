import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { ChevronRight, FolderTree } from "lucide-react";
import { db } from "@/db";
import { categories, topics } from "@/db/schema";
import { GameIcon } from "@/components/game-icon";
import { NewCategoryForm, type CategoryOption } from "@/components/admin/category-controls";
import { resolveText } from "@/i18n/locales";

export const dynamic = "force-dynamic";

/** Categories section: nested list + create (optionally under a parent). */
export default async function AdminCategoriesPage() {
  const [cats, dsCounts] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)).catch(() => []),
    db
      .select({ categoryId: topics.categoryId, n: sql<number>`count(*)::int` })
      .from(topics)
      .groupBy(topics.categoryId)
      .catch(() => []),
  ]);
  const dsByCat = new Map(dsCounts.filter((c) => c.categoryId).map((c) => [c.categoryId, c.n]));
  const options: CategoryOption[] = cats.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: resolveText(c.title, "uk"),
  }));
  const childrenOf = (id: string | null) => cats.filter((c) => c.parentId === (id ?? null));

  const renderNode = (c: (typeof cats)[number], depth: number): React.ReactNode => {
    const kids = childrenOf(c.id);
    return (
      <div key={c.id} className="flex flex-col gap-2">
        <Link
          href={`/admin/categories/${c.slug}`}
          style={{ marginLeft: depth * 20 }}
          className="glass-card flex items-center gap-3 p-3 transition-colors hover:border-accent/60"
        >
          <GameIcon name={c.icon ?? undefined} size={18} />
          <span className="flex flex-1 flex-col">
            <span className="font-semibold">{resolveText(c.title, "uk")}</span>
            <span className="text-[11px] text-muted">
              /{c.slug} · датасетів: {dsByCat.get(c.id) ?? 0}
              {kids.length ? ` · підкатегорій: ${kids.length}` : ""}
            </span>
          </span>
          <ChevronRight size={16} className="text-muted" />
        </Link>
        {kids.map((k) => renderNode(k, depth + 1))}
      </div>
    );
  };

  return (
    <>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <FolderTree size={20} /> Категорії
      </h1>
      <p className="text-sm text-muted">
        Категорія групує датасети в каталозі. Можна вкладати категорії одна в одну.
        Відкрий категорію, щоб додати всередину датасети.
      </p>

      <section className="flex flex-col gap-2">
        {cats.length === 0 && <p className="text-sm text-muted">Ще немає категорій.</p>}
        {childrenOf(null).map((c) => renderNode(c, 0))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
          Нова категорія
        </h2>
        <NewCategoryForm parents={options} />
      </section>
    </>
  );
}
