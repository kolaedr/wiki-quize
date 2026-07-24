import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Database, Gamepad2, Layers, ListChecks, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { games, importJobs, topicEntities, topics } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { failStaleJobs } from "@/lib/ingest/run";
import { requireSuperPage } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

/** Admin overview: key counts + the latest import jobs. */
export default async function AdminOverviewPage() {
  await requireSuperPage();
  // Jobs killed by the serverless time limit must not show "running" forever
  await failStaleJobs().catch(() => {});

  const [[topicN], [entityN], [gameN], [publishedN], jobRows] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(topics).catch(() => [{ n: 0 }]),
    db.select({ n: sql<number>`count(*)::int` }).from(topicEntities).catch(() => [{ n: 0 }]),
    db.select({ n: sql<number>`count(*)::int` }).from(games).catch(() => [{ n: 0 }]),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(games)
      .where(eq(games.status, "published"))
      .catch(() => [{ n: 0 }]),
    db.select().from(importJobs).orderBy(desc(importJobs.createdAt)).limit(8).catch(() => []),
  ]);

  const stats = [
    { label: "Датасети", value: topicN?.n ?? 0, icon: Database, href: "/admin/topics" },
    { label: "Сутності", value: entityN?.n ?? 0, icon: Layers, href: "/admin/topics" },
    { label: "Ігри", value: gameN?.n ?? 0, icon: Gamepad2, href: "/admin/games" },
    { label: "Опубліковано", value: publishedN?.n ?? 0, icon: ShieldCheck, href: "/admin/games" },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Огляд</h1>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/topics">Датасети</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/games">Ігри</Link>
          </Button>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="glass-card flex flex-col gap-2 p-4 transition-colors hover:border-accent/50"
          >
            <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
              <Icon size={14} /> {label}
            </span>
            <span className="font-display text-3xl font-bold">{value}</span>
          </Link>
        ))}
      </div>

      {/* recent jobs */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-muted">
          <ListChecks size={15} /> Останні джоби імпорту
        </h2>
        {jobRows.length === 0 && <p className="text-sm text-muted">Поки порожньо.</p>}
        {jobRows.map((j) => (
          <div key={j.id} className="glass-card flex items-center justify-between p-3 text-xs">
            <span
              className={
                j.status === "failed"
                  ? "text-danger"
                  : j.status === "done"
                    ? "text-success"
                    : "text-muted"
              }
            >
              {j.status}
            </span>
            <span className="text-muted">
              {j.startedAt ? new Date(j.startedAt).toLocaleString("uk-UA") : "—"}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
