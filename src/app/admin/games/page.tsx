import { and, asc, desc, eq, sql } from "drizzle-orm";
import { Gamepad2 } from "lucide-react";
import { db } from "@/db";
import { games, topics } from "@/db/schema";
import { GameAdminCard } from "@/components/admin/game-admin-card";
import { GamesFilter } from "@/components/admin/games-filter";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";
const PAGE = 15;

/** Games: filter/sort/search + paginated; publish, preview, edit. */
export default async function AdminGamesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; sort?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const status = sp.status ?? "all";
  const sort = sp.sort ?? "new";
  const q = (sp.q ?? "").trim();

  const conds = [];
  if (["published", "unlisted", "blocked", "draft"].includes(status))
    conds.push(sql`${games.status} = ${status}`);
  if (q)
    conds.push(
      sql`(${games.slug} ILIKE ${`%${q}%`} OR ${games.title}->>'uk' ILIKE ${`%${q}%`} OR ${games.title}->>'en' ILIKE ${`%${q}%`})`,
    );
  const where = conds.length ? and(...conds) : undefined;
  const order =
    sort === "plays"
      ? desc(games.playsCount)
      : sort === "title"
        ? asc(sql`${games.title}->>'uk'`)
        : sort === "status"
          ? asc(games.status)
          : desc(games.createdAt);

  const gameRows = await db
    .select({ game: games, fieldSchema: topics.fieldSchema })
    .from(games)
    .innerJoin(topics, eq(topics.id, games.topicId))
    .where(where)
    .orderBy(order)
    .limit(PAGE + 1)
    .offset((page - 1) * PAGE)
    .catch(() => []);
  const hasNext = gameRows.length > PAGE;
  const rows = gameRows.slice(0, PAGE);

  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (sort !== "new") params.set("sort", sort);
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    return `/admin/games${params.toString() ? `?${params.toString()}` : ""}`;
  };

  return (
    <>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Gamepad2 size={20} /> Ігри
      </h1>

      <GamesFilter status={status} sort={sort} q={q} />

      {rows.length === 0 && (
        <p className="text-sm text-muted">
          {q || status !== "all"
            ? "Нічого не знайдено за цим фільтром."
            : "Ігри створюються після імпорту теми (як unlisted). Опублікуй їх тут кнопкою."}
        </p>
      )}

      <section className="flex flex-col gap-3">
        {rows.map((row) => (
          <GameAdminCard
            key={row.game.id}
            game={row.game}
            fieldSchema={(row.fieldSchema ?? []) as { role: string; kind: string }[]}
          />
        ))}
      </section>

      <Pagination page={page} hasNext={hasNext} makeHref={makeHref} />
    </>
  );
}
