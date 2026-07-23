import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { Database, Gamepad2, ListChecks } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { db } from "@/db";
import { games, importJobs, topicEntities, topics } from "@/db/schema";
import { resolveText } from "@/i18n/locales";
import {
  importPresetAction,
  setGameStatusAction,
} from "@/lib/admin/actions";
import { getAdminSession } from "@/lib/admin/guard";
import { PRESETS } from "@/lib/ingest/presets";
import { failStaleJobs } from "@/lib/ingest/run";
import { ActionButton } from "@/components/admin/action-button";
import { NewTopicForm } from "@/components/admin/new-topic-form";
import { GameIcon } from "@/components/game-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Rows3 } from "lucide-react";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // imports run inside server actions

/** Super-admin panel: topics (import/sync by click), games, jobs. */
export default async function AdminPage() {
  if (!(await getAdminSession())) redirect("/");

  // Jobs killed by the serverless time limit must not show "running" forever
  await failStaleJobs().catch(() => {});

  const [topicRows, gameRows, jobRows, counts] = await Promise.all([
    db.select().from(topics).catch(() => []),
    db.select().from(games).catch(() => []),
    db.select().from(importJobs).orderBy(desc(importJobs.createdAt)).limit(10).catch(() => []),
    db
      .select({ topicId: topicEntities.topicId, n: sql<number>`count(*)::int` })
      .from(topicEntities)
      .groupBy(topicEntities.topicId)
      .catch(() => []),
  ]);
  const countByTopic = new Map(counts.map((c) => [c.topicId, c.n]));
  const topicBySlug = new Map(topicRows.map((t) => [t.slug, t]));

  return (
    <>
      <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-6 overflow-y-auto px-5 py-4">
        <Breadcrumbs items={[{ label: "Адмінка" }]} />
        {/* Topics: import presets by click */}
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-muted">
            <Database size={15} /> Теми
          </h2>
          {[
            // DB topics (seeded, imported, no-code) + code presets not imported yet
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
              | { accepted?: number; fieldCoverage?: Record<string, number> }
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
                  </div>
                </div>
                {report?.fieldCoverage && (
                  <p className="text-[11px] leading-4 text-muted">
                    Покриття полів:{" "}
                    {Object.entries(report.fieldCoverage)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(" · ")}
                  </p>
                )}
              </div>
            );
          })}

          <h3 className="mt-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">
            Нова тема (no-code: клас Wikidata + поля → ігри автоматично)
          </h3>
          <NewTopicForm />
        </section>

        {/* Games */}
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-muted">
            <Gamepad2 size={15} /> Ігри
          </h2>
          {gameRows.length === 0 && (
            <p className="text-sm text-muted">
              Ігри створюються автоматично після імпорту теми (з рівнями складності по
              кількості айтемів).
            </p>
          )}
          {gameRows.map((g) => {
            const cfg = (g.config ?? {}) as { levels?: number; perLevel?: number };
            return (
              <div key={g.id} className="glass-card flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <GameIcon name={(g.style as { icon?: string })?.icon} size={20} className="h-9 w-9" />
                  <div>
                  <p className="font-semibold">{resolveText(g.title, "uk")}</p>
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Badge
                      variant={
                        g.status === "published"
                          ? "success"
                          : g.status === "unlisted"
                            ? "muted"
                            : "danger"
                      }
                    >
                      {g.status}
                    </Badge>
                    рівнів: {cfg.levels ?? 1} (по {cfg.perLevel ?? 20}) · зіграно: {g.playsCount}
                  </p>
                  </div>
                </div>
                <Button asChild size="sm" variant="ghost" title="Прев'ю (працює і для unlisted)">
                  <Link href={`/play/${g.slug}`}>
                    <Play size={13} /> Грати
                  </Link>
                </Button>
                <ActionButton
                  variant="ghost"
                  label={g.status === "published" ? "Зняти" : "Опублікувати"}
                  action={setGameStatusAction.bind(
                    null,
                    g.id,
                    g.status === "published" ? "unlisted" : "published",
                  )}
                />
              </div>
            );
          })}
        </section>

        {/* Jobs */}
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-muted">
            <ListChecks size={15} /> Останні джоби
          </h2>
          {jobRows.length === 0 && <p className="text-sm text-muted">Поки порожньо.</p>}
          {jobRows.map((j) => (
            <div key={j.id} className="glass-card flex items-center justify-between p-3 text-xs">
              <span className={j.status === "failed" ? "text-danger" : j.status === "done" ? "text-success" : "text-muted"}>
                {j.status}
              </span>
              <span className="text-muted">
                {j.startedAt ? new Date(j.startedAt).toLocaleString("uk-UA") : "—"}
              </span>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
