import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { GameBoard } from "@/components/game/game-board";
import { SAMPLE_COUNTRIES } from "@/data/sample-countries";
import { buildChoiceDeck } from "@/lib/deck/build";
import type { DeckEntity } from "@/lib/deck/types";

export const dynamic = "force-dynamic"; // deck varies per day

/**
 * Demo deck: "Flags of the World" over the bundled sample (works before the
 * DB is populated). Once import runs, this page switches to topic_entities.
 */
export default async function PlayPage() {
  const locale = await getLocale();
  const t = await getTranslations();

  const today = new Date().toISOString().slice(0, 10);
  const cards = buildChoiceDeck(SAMPLE_COUNTRIES, {
    seed: `flags-demo-${today}`,
    locale,
    deckSize: 10,
    prompt: (e: DeckEntity) => ({
      image: e.imageUrl ?? undefined,
      emoji: (e.values.flagEmoji as string) ?? undefined,
    }),
    option: (e: DeckEntity) => ({ label: e.labels[locale] ?? e.labels.en }),
  });

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-4">
        <Link href="/" className="text-sm text-muted hover:text-fg">
          ← {t("app.name")}
        </Link>
        <span className="glass-card px-3 py-1 text-xs text-muted">demo</span>
      </header>
      <GameBoard title={t("game.flagsTitle")} cards={cards} />
    </>
  );
}
