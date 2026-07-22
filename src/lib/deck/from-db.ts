import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, topicEntities } from "@/db/schema";
import type { LocalizedText } from "@/i18n/locales";
import { buildChoiceDeck } from "./build";
import type { ChoiceCard, DeckEntity } from "./types";

export interface GameDecks {
  gameId: string;
  title: LocalizedText;
  duelCards: ChoiceCard[];
  quadCards: ChoiceCard[];
}

/**
 * Load a published game + its topic entities and build both layouts'
 * decks server-side (seeded). config.answerRole picks which image field
 * plays the "answer" side (flag / arms / logo / …).
 */
export async function loadGameDecks(
  slug: string,
  locale: string,
  seed: string,
): Promise<GameDecks | null> {
  const [game] = await db
    .select()
    .from(games)
    .where(and(eq(games.slug, slug), eq(games.status, "published")))
    .limit(1);
  if (!game) return null;

  const cfg = (game.config ?? {}) as { answerRole?: string; deckSize?: number };
  const role = cfg.answerRole ?? "flag";
  const deckSize = cfg.deckSize ?? 10;

  const rows = await db
    .select()
    .from(topicEntities)
    .where(
      and(
        eq(topicEntities.topicId, game.topicId),
        eq(topicEntities.excluded, false),
        isNotNull(sql`${topicEntities.values} ->> ${role}`),
      ),
    );

  const entities: DeckEntity[] = rows.map((r) => ({
    qid: r.wikidataQid,
    labels: r.labels,
    values: r.values as Record<string, unknown>,
    imageUrl: r.imageUrl,
    wikiLinks: r.wikiLinks,
    difficultyScore: r.difficultyScore,
  }));

  const image = (e: DeckEntity) => (e.values[role] as string | undefined) ?? undefined;
  const label = (e: DeckEntity) => e.labels[locale] ?? e.labels.en;

  return {
    gameId: game.id,
    title: game.title,
    // duel: label on top → pair of image cards
    duelCards: buildChoiceDeck(entities, {
      seed: `${slug}-duel-${seed}`,
      locale,
      deckSize,
      optionCount: 2,
      prompt: (e) => ({ label: label(e) }),
      option: (e) => ({ image: image(e) }),
    }),
    // quad: image prompt → 4 labels
    quadCards: buildChoiceDeck(entities, {
      seed: `${slug}-quad-${seed}`,
      locale,
      deckSize,
      optionCount: 4,
      prompt: (e) => ({ image: image(e) }),
      option: (e) => ({ label: label(e) }),
    }),
  };
}

/** Published games for the home catalog (safe: returns [] when the DB is empty/unreachable). */
export async function listPublishedGames() {
  try {
    return await db
      .select({
        slug: games.slug,
        title: games.title,
        style: games.style,
        playsCount: games.playsCount,
      })
      .from(games)
      .where(eq(games.status, "published"));
  } catch {
    return [];
  }
}
