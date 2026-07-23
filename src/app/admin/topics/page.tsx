import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { Database, Rows3 } from "lucide-react";
import { db } from "@/db";
import { categories, topicEntities, topics } from "@/db/schema";
import { resolveText } from "@/i18n/locales";
import { deleteTopicAction, importPresetAction, resetContentAction } from "@/lib/admin/actions";
import { PRESETS } from "@/lib/ingest/presets";
import { ActionButton } from "@/components/admin/action-button";
import { CategorySelect } from "@/components/admin/category-controls";
import { DraftDatasetForm } from "@/components/admin/draft-dataset-form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // imports run inside server actions

/** Topics: import / resync by click, plus the no-code topic builder. */
export default async function AdminTopicsPage() {
  const [topicRows, counts, categoryRows] = await Promise.all([
    db.select().from(topics).catch(() => []),
    db
      .select({ topicId: topicEntities.topicId, n: sql<number>`count(*)::int` })
      .from(topicEntities)
      .groupBy(topicEntities.topicId)
      .catch(() => []),
    db.select().from(categories).orderBy(asc(categories.sortOrder)).catch(() => []),
  ]);
  const countByTopic = new Map(counts.map((c) => [c.topicId, c.n]));
  const topicBySlug = new Map(topicRows.map((t) => [t.slug, t]));
  const categoryOptions = categoryRows.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: resolveText(c.title, "uk"),
  }));

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

      <p className="text-xs text-muted">
        Категорії — в окремому розділі. Тут признач датасету категорію у випадайці
        поруч, або створюй/додавай датасети зсередини категорії.
      </p>

      <section className="flex flex-col gap-3">
        {[
          ...topicRows.map((t) => ({
            slug: t.slug,
            title: t.title,
            topic: t,
            importKey: (t.sourceConfig as { preset?: string })?.preset ?? t.slug,
          })),
          ...Object.values(PRESETS)
            .filter((p) => !topicBySlug.has(p.slug))
            .map((p) => ({ slug: p.slug, title: p.title, topic: null, importKey: p.key })),
        ].map(({ slug, title, topic, importKey }) => {
          const report = topic?.validationReport as
            | {
                accepted?: number;
                totalExisting?: number;
                fieldCoverage?: Record<string, number>;
              }
            | null
            | undefined;
          return (
            <div key={slug} className="glass-card flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{resolveText(title, "uk")}</p>
                  <p className="text-xs text-muted">
                    {topic
                      ? `${topic.status} · ${countByTopic.get(topic.id) ?? 0} сутностей · синк: ${
                          topic.syncedAt ? new Date(topic.syncedAt).toLocaleString("uk-UA") : "—"
                        }`
                      : "ще не імпортовано"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {topic && (
                    <CategorySelect
                      topicSlug={slug}
                      categoryId={topic.categoryId}
                      options={categoryOptions}
                    />
                  )}
                  {topic && (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/admin/topics/${slug}`}>
                        <Rows3 size={13} /> Айтеми
                      </Link>
                    </Button>
                  )}
                  <ActionButton
                    label={topic ? "Синхронізувати" : "Імпортувати"}
                    action={importPresetAction.bind(null, importKey)}
                  />
                  {topic && (
                    <ActionButton
                      variant="ghost"
                      confirm
                      iconOnly
                      icon="trash"
                      label="Видалити датасет"
                      action={deleteTopicAction.bind(null, slug)}
                    />
                  )}
                </div>
              </div>
              {report?.fieldCoverage && (
                <p className="text-[11px] leading-4 text-muted">
                  {report.totalExisting != null &&
                    `Отримано ${report.accepted ?? 0} з ${report.totalExisting} існуючих · `}
                  Покриття полів:{" "}
                  {Object.entries(report.fieldCoverage)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(" · ")}
                </p>
              )}
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
          Новий датасет
        </h2>
        <DraftDatasetForm />
      </section>
    </>
  );
}
