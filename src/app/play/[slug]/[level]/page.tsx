import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { PlayScreen } from "@/components/game/play-screen";
import { resolveText } from "@/i18n/locales";
import { getAdminSession } from "@/lib/admin/guard";
import { loadGameDecks } from "@/lib/deck/from-db";

export const dynamic = "force-dynamic"; // deck seed varies per day

/** One difficulty level of a DB-backed game. */
export default async function GameLevelPage({
  params,
}: {
  params: Promise<{ slug: string; level: string }>;
}) {
  const { slug, level: levelParam } = await params;
  const level = Number.parseInt(levelParam, 10);
  if (!Number.isFinite(level) || level < 1) notFound();

  const locale = await getLocale();
  const seed = new Date().toISOString().slice(0, 10);

  let decks;
  try {
    decks = await loadGameDecks(slug, locale, seed, level);
    // admins can preview unlisted games
    if (!decks && (await getAdminSession())) {
      decks = await loadGameDecks(slug, locale, seed, level, true);
    }
  } catch {
    decks = null;
  }
  const hasCards =
    decks &&
    (decks.duelCards.length > 0 || decks.quadCards.length > 0 || decks.binaryCards.length > 0);
  if (!decks || !hasCards) notFound();

  const mech =
    decks.mechanic === "swipe_binary" || decks.mechanic === "higher_lower"
      ? decks.mechanic
      : "choice";

  return (
    <PlayScreen
      title={`${resolveText(decks.title, locale)} · ${decks.level}`}
      mechanic={mech}
      duelCards={decks.duelCards}
      quadCards={decks.quadCards}
      binaryCards={decks.binaryCards}
      gameId={decks.gameId}
      seed={`${seed}#L${decks.level}`}
      slug={decks.slug}
      level={decks.level}
      backHref={`/play/${decks.slug}`}
    />
  );
}
