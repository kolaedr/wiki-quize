import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { PlayScreen } from "@/components/game/play-screen";
import { resolveText } from "@/i18n/locales";
import { loadGameDecks } from "@/lib/deck/from-db";

export const dynamic = "force-dynamic"; // deck seed varies per day

/** DB-backed game: deck built from topic_entities, sessions persisted. */
export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const seed = new Date().toISOString().slice(0, 10);

  let decks;
  try {
    decks = await loadGameDecks(slug, locale, seed);
  } catch {
    decks = null; // DB unreachable → treat as missing
  }
  if (!decks || decks.duelCards.length === 0) notFound();

  return (
    <PlayScreen
      title={resolveText(decks.title, locale)}
      duelCards={decks.duelCards}
      quadCards={decks.quadCards}
      gameId={decks.gameId}
      seed={seed}
    />
  );
}
