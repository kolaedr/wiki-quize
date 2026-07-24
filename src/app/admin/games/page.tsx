import Link from "next/link";
import { desc } from "drizzle-orm";
import { Gamepad2, Play } from "lucide-react";
import { db } from "@/db";
import { games } from "@/db/schema";
import { resolveText } from "@/i18n/locales";
import { setGameStatusAction } from "@/lib/admin/actions";
import { ActionButton } from "@/components/admin/action-button";
import { GameEditor } from "@/components/admin/game-editor";
import { GameIcon } from "@/components/game-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/** Games: publish / unpublish, preview (works for unlisted too). */
export default async function AdminGamesPage() {
  const gameRows = await db
    .select()
    .from(games)
    .orderBy(desc(games.createdAt))
    .catch(() => []);

  return (
    <>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Gamepad2 size={20} /> Ігри
      </h1>

      {gameRows.length === 0 && (
        <p className="text-sm text-muted">
          Ігри створюються після імпорту теми (як unlisted). Опублікуй їх тут кнопкою.
        </p>
      )}

      <section className="flex flex-col gap-3">
        {gameRows.map((g) => {
          const cfg = (g.config ?? {}) as {
            levels?: number;
            perLevel?: number;
            deckSize?: number;
            itemsCount?: number;
          };
          return (
            <div key={g.id} className="glass-card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-3">
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
                      /{g.slug} · рівнів: {cfg.levels ?? 1} (по {cfg.perLevel ?? 20})
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
              <GameEditor
                gameId={g.id}
                titleEn={(g.title as { en?: string }).en ?? ""}
                titleUk={(g.title as { uk?: string }).uk ?? ""}
                deckSize={cfg.deckSize ?? 10}
                perLevel={cfg.perLevel ?? 20}
                itemsCount={cfg.itemsCount}
              />
            </div>
          );
        })}
      </section>
    </>
  );
}
