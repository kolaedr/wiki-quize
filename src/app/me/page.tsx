import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { ChevronRight, Crown, Gamepad2, Medal, Trophy, Users } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { db } from "@/db";
import { games, sessions } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { GameIcon } from "@/components/game-icon";
import { Pagination } from "@/components/pagination";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { resolveText } from "@/i18n/locales";
import { auth } from "@/lib/auth";
import { PAGE_SIZE } from "@/lib/deck/from-db";

export const dynamic = "force-dynamic";

/** User cabinet: personal stats, recent sessions (paginated), leaderboard. */
export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/auth");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const locale = await getLocale();
  const t = await getTranslations();
  const uid = session.user.id;

  const [totals, best, recent, leaderboard] = await Promise.all([
    db
      .select({
        played: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(${sessions.score}), 0)::int`,
      })
      .from(sessions)
      .where(eq(sessions.userId, uid))
      .then((r) => r[0]),
    db
      .select({
        title: games.title,
        style: games.style,
        best: sql<number>`max(${sessions.score})::int`,
      })
      .from(sessions)
      .innerJoin(games, eq(games.id, sessions.gameId))
      .where(eq(sessions.userId, uid))
      .groupBy(games.id)
      .orderBy(desc(sql`max(${sessions.score})`))
      .limit(5),
    db
      .select({
        id: sessions.id,
        score: sessions.score,
        createdAt: sessions.createdAt,
        title: games.title,
        style: games.style,
      })
      .from(sessions)
      .innerJoin(games, eq(games.id, sessions.gameId))
      .where(eq(sessions.userId, uid))
      .orderBy(desc(sessions.createdAt))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({
        name: user.name,
        userId: sessions.userId,
        total: sql<number>`sum(${sessions.score})::int`,
      })
      .from(sessions)
      .innerJoin(user, eq(user.id, sessions.userId))
      .where(and(isNotNull(sessions.userId), isNotNull(sessions.finishedAt)))
      .groupBy(sessions.userId, user.name)
      .orderBy(desc(sql`sum(${sessions.score})`))
      .limit(10),
  ]);

  const hasNext = recent.length > PAGE_SIZE;
  const recentItems = recent.slice(0, PAGE_SIZE);
  const myRank = leaderboard.findIndex((l) => l.userId === uid);

  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-4">
        <Breadcrumbs items={[{ label: t("auth.cabinet") }]} />
        {/* profile + totals */}
        <div className="glass-card flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold">
                {session.user.name || session.user.email}
              </h1>
              <p className="text-xs text-muted">{session.user.email}</p>
            </div>
            <SignOutButton />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-accent">{totals.played}</p>
              <p className="text-xs text-muted">{t("me.played")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-accent">{totals.total}</p>
              <p className="text-xs text-muted">{t("me.totalScore")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-accent">
                {myRank >= 0 ? `#${myRank + 1}` : "—"}
              </p>
              <p className="text-xs text-muted">{t("me.rank")}</p>
            </div>
          </div>
        </div>

        {/* teams entry */}
        <Link
          href="/team"
          className="glass-card flex items-center gap-3 p-4 transition-colors hover:border-accent/60"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Users size={18} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold">Команди</span>
            <span className="block text-xs text-muted">Грайте разом — рідні, друзі, клас</span>
          </span>
          <ChevronRight size={16} className="text-muted" />
        </Link>

        <div className="grid gap-6 md:grid-cols-2">
        {/* best per game */}
        {best.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-muted">
              <Trophy size={15} /> {t("me.bestResults")}
            </h2>
            {best.map((b, i) => (
              <div key={i} className="glass-card flex items-center gap-3 p-3">
                <GameIcon name={(b.style as { icon?: string })?.icon} size={18} className="h-9 w-9" />
                <span className="flex-1 text-sm font-medium">
                  {resolveText(b.title, locale)}
                </span>
                <span className="font-bold text-accent">{b.best}</span>
              </div>
            ))}
          </section>
        )}

        {/* leaderboard */}
        {leaderboard.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-muted">
              <Crown size={15} /> {t("me.leaderboard")}
              <Link href="/leaderboard" className="ml-auto text-xs font-medium normal-case text-accent hover:underline">
                весь рейтинг →
              </Link>
            </h2>
            <div className="glass-card flex flex-col divide-y divide-line p-2">
              {leaderboard.map((l, i) => (
                <div
                  key={l.userId}
                  className={`flex items-center gap-3 px-2 py-2.5 text-sm ${
                    l.userId === uid ? "text-accent" : ""
                  }`}
                >
                  <span className="w-6 text-center">
                    {i < 3 ? <Medal size={15} className="inline text-accent-2" /> : i + 1}
                  </span>
                  <span className="flex-1 truncate font-medium">{l.name}</span>
                  <span className="font-semibold">{l.total}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        </div>

        {/* recent sessions (paginated) */}
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-muted">
            <Gamepad2 size={15} /> {t("me.recent")}
          </h2>
          {recentItems.length === 0 && (
            <p className="text-sm text-muted">{t("me.noGames")}</p>
          )}
          {recentItems.map((s) => (
            <div key={s.id} className="glass-card flex items-center gap-3 p-3 text-sm">
              <GameIcon name={(s.style as { icon?: string })?.icon} size={16} className="h-8 w-8" />
              <span className="flex-1">{resolveText(s.title, locale)}</span>
              <span className="text-xs text-muted">
                {new Date(s.createdAt).toLocaleDateString(locale)}
              </span>
              <span className="w-12 text-right font-semibold text-accent">{s.score}</span>
            </div>
          ))}
          <Pagination page={page} hasNext={hasNext} makeHref={(p) => `/me?page=${p}`} />
        </section>
      </main>
    </>
  );
}
