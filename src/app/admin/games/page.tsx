import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { Gamepad2, Play, Search } from "lucide-react";
import { db } from "@/db";
import { games } from "@/db/schema";
import { resolveText } from "@/i18n/locales";
import { setGameStatusAction } from "@/lib/admin/actions";
import { ActionButton } from "@/components/admin/action-button";
import { GameIcon } from "@/components/game-icon";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const PAGE = 20;

/** Games: publish / unpublish, preview (works for unlisted too). */
export default async function AdminGamesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q: qParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const q = (qParam ?? "").trim();

  const titleMatch = q
    ? sql`EXISTS (
        SELECT 1 FROM jsonb_each_text(${games.title}) AS t(locale, label)
        WHERE t.label ILIKE ${"%" + q + "%"}
      )`
    : undefined;

  const rows = await db
    .select()
    .from(games)
    .where(titleMatch)
    .orderBy(desc(games.createdAt))
    .limit(PAGE + 1)
    .offset((page - 1) * PAGE)
    .catch(() => []);

  const hasNext = rows.length > PAGE;
  const gameRows = rows.slice(0, PAGE);

  const querySuffix = q ? `&q=${encodeURIComponent(q)}` : "";

  return (
    <>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Gamepad2 size={20} /> Ігри
      </h1>

      <form method="get" className="flex gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Пошук за назвою…"
          className="h-10"
          aria-label="Пошук за назвою"
        />
        <Button type="submit" size="sm" variant="secondary">
          <Search size={13} /> Шукати
        </Button>
      </form>

      {gameRows.length === 0 && (
        <p className="text-sm text-muted">
          {q
            ? `Нічого не знайдено за «${q}».`
            : "Ігри створюються після імпорту теми (як unlisted). Опублікуй їх тут кнопкою."}
        </p>
      )}

      <section className="flex flex-col gap-3">
        {gameRows.map((g) => {
          const cfg = (g.config ?? {}) as {
            levels?: number;
            perLevel?: number;
            itemsCount?: number;
          };
          return (
            <div key={g.id} className="glass-card flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <GameIcon name={(g.style as { icon?: string })?.icon} size={20} className="h-9 w-9" />
                <div>
                  <p className="font-semibold">{resolveText(g.title, "uk")}</p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
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
                    рівнів: {cfg.levels ?? 1} (по {cfg.perLevel ?? 20})
                    {cfg.itemsCount != null && ` · айтемів: ${cfg.itemsCount}`} · зіграно:{" "}
                    {g.playsCount}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
            </div>
          );
        })}
      </section>

      <Pagination
        page={page}
        hasNext={hasNext}
        makeHref={(p) => `/admin/games?page=${p}${querySuffix}`}
      />
    </>
  );
}
