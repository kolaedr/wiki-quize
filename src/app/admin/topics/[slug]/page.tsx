import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { ChevronLeft, ImageOff } from "lucide-react";
import { db } from "@/db";
import { topicEntities, topics } from "@/db/schema";
import { ActionButton } from "@/components/admin/action-button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { resolveText } from "@/i18n/locales";
import { toggleEntityAction } from "@/lib/admin/actions";
import { getAdminSession } from "@/lib/admin/guard";

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
  if (!(await getAdminSession())) redirect("/");
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const [topic] = await db.select().from(topics).where(eq(topics.slug, slug)).limit(1);
  if (!topic) notFound();

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
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 pt-4">
        <Link href="/admin" className="flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ChevronLeft size={16} />
          Адмінка
        </Link>
        <Badge variant="muted">вимкнено: {total}</Badge>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
        <h1 className="font-display text-2xl font-bold">
          {resolveText(topic.title, "uk")} — айтеми
        </h1>

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
      </main>
    </>
  );
}
