import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { GameBoard } from "@/components/game/game-board";
import { demoQuadDeck } from "@/lib/deck/demo";

export const dynamic = "force-dynamic";

export default async function QuadPage() {
  const locale = await getLocale();
  const t = await getTranslations();
  const cards = demoQuadDeck(locale, new Date().toISOString().slice(0, 10));

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-4">
        <Link href="/play" className="text-sm text-muted hover:text-fg">
          ← {t("game.chooseMode")}
        </Link>
        <span className="glass-card px-3 py-1 text-xs text-muted">demo</span>
      </header>
      <GameBoard title={t("game.flagsTitle")} cards={cards} />
    </>
  );
}
