import Link from "next/link";
import { Play } from "lucide-react";
import type { LocalizedText } from "@/db/schema";
import { resolveText } from "@/i18n/locales";
import { setGameStatusAction } from "@/lib/admin/actions";
import { ActionButton } from "@/components/admin/action-button";
import { GameEditor } from "@/components/admin/game-editor";
import { GameIcon } from "@/components/game-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface AdminGameRow {
  id: string;
  slug: string;
  title: LocalizedText;
  style: unknown;
  status: string;
  playsCount: number;
  mechanic: string;
  config: unknown;
}

/** The single game admin card — same in the games list and inside a category. */
export function GameAdminCard({
  game,
  fieldSchema = [],
  mod = false,
}: {
  game: AdminGameRow;
  fieldSchema?: { role: string; kind: string }[];
  /** moderator view: the editor shows only title + icon */
  mod?: boolean;
}) {
  const g = game;
  const cfg = (g.config ?? {}) as {
    levels?: number;
    perLevel?: number;
    deckSize?: number;
    itemsCount?: number;
    answerRole?: string;
    promptImageRole?: string;
    imageRole?: string;
    valueRole?: string;
    refRole?: string;
    promptImage?: boolean;
    promptShow?: "text" | "image" | "both";
    optionShow?: "text" | "image" | "both";
    promptBlur?: number;
    stackedDefault?: boolean;
  };
  const style = (g.style ?? {}) as { icon?: string; cover?: string };

  return (
    <div className="glass-card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {style.cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- Commons thumb
            <img src={style.cover} alt="" className="h-9 w-12 rounded object-contain" />
          ) : (
            <GameIcon name={style.icon} size={20} className="h-9 w-9" />
          )}
          <div>
            <p className="font-semibold">{resolveText(g.title, "uk")}</p>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Badge
                variant={
                  g.status === "published" ? "success" : g.status === "unlisted" ? "muted" : "danger"
                }
              >
                {g.status}
              </Badge>
              /{g.slug} · рівнів: {cfg.levels ?? 1} (по {cfg.perLevel ?? 20})
              {cfg.itemsCount != null && ` · айтемів: ${cfg.itemsCount}`} · зіграно: {g.playsCount}
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
        mechanic={g.mechanic}
        fields={fieldSchema}
        answerRole={cfg.answerRole}
        promptImageRole={cfg.promptImageRole}
        imageRole={cfg.imageRole}
        valueRole={cfg.valueRole}
        refRole={cfg.refRole}
        promptShow={cfg.promptShow ?? ""}
        optionShow={cfg.optionShow ?? ""}
        promptBlur={cfg.promptBlur}
        stackedDefault={cfg.stackedDefault}
        cover={style.cover}
        icon={style.icon}
        mod={mod}
      />
    </div>
  );
}
