import { headers } from "next/headers";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { Crown, Medal } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TOP_N = 50;

/** Public leaderboard: best players by total score across finished games. */
export default async function LeaderboardPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  const uid = session?.user?.id ?? null;

  const rows = await db
    .select({
      userId: sessions.userId,
      name: user.name,
      total: sql<number>`sum(${sessions.score})::int`,
      played: sql<number>`count(*)::int`,
    })
    .from(sessions)
    .innerJoin(user, eq(user.id, sessions.userId))
    .where(and(isNotNull(sessions.userId), isNotNull(sessions.finishedAt)))
    .groupBy(sessions.userId, user.name)
    .orderBy(desc(sql`sum(${sessions.score})`))
    .limit(TOP_N)
    .catch(() => []);

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
      <Breadcrumbs items={[{ label: "Рейтинг" }]} />
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Crown size={22} className="text-accent-2" /> Найкращі гравці
      </h1>

      {rows.length === 0 && (
        <p className="text-sm text-muted">
          Ще ніхто не завершив жодної гри. Зіграй перший — і потрап у рейтинг!
        </p>
      )}

      {rows.length > 0 && (
        <div className="glass-card flex flex-col divide-y divide-line p-2">
          {rows.map((r, i) => (
            <div
              key={r.userId}
              className={`flex items-center gap-3 px-2 py-3 text-sm ${
                r.userId === uid ? "text-accent" : ""
              }`}
            >
              <span className="w-8 text-center font-semibold">
                {i < 3 ? <Medal size={17} className="inline text-accent-2" /> : i + 1}
              </span>
              <span className="flex-1 truncate font-medium">
                {r.name}
                {r.userId === uid && <span className="ml-1 text-[11px] text-muted">(ти)</span>}
              </span>
              <span className="text-xs text-muted">ігор: {r.played}</span>
              <span className="w-16 text-right font-bold text-accent">{r.total}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
