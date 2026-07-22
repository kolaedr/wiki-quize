import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { games, topicEntities } from "@/db/schema";
import type { LocalizedText } from "@/i18n/locales";
import {
  buildBinaryDeck,
  buildChoiceDeck,
  buildHigherLowerDeck,
  buildRefChoiceDeck,
} from "./build";
import type { BinaryCard, ChoiceCard, DeckEntity } from "./types";

export type Mechanic = "choice" | "higher_lower" | "swipe_binary" | "timeline_ribbon" | "odd_one_out";

export interface GameConfig {
  deckSize: number;
  perLevel: number;
  levels: number;
  /** choice: own image attribute (flag/arms/logo) */
  answerRole?: string;
  /** choice over a relation: values[refRole] = [{qid, labels}] */
  refRole?: string;
  promptImageRole?: string;
  /** higher_lower */
  valueRole?: string;
  tmpl?: string;
  imageRole?: string;
  /** swipe_binary */
  roles?: { role: string; tmpl: string }[];
}

export interface GameMeta {
  gameId: string;
  slug: string;
  mechanic: Mechanic;
  title: LocalizedText;
  style: { emoji?: string };
  config: GameConfig;
  topicId: string;
}

export interface GameDecks extends GameMeta {
  level: number;
  duelCards: ChoiceCard[];
  quadCards: ChoiceCard[];
  binaryCards: BinaryCard[];
}

function parseConfig(raw: unknown): GameConfig {
  const c = (raw ?? {}) as Partial<GameConfig>;
  return {
    deckSize: c.deckSize ?? 10,
    perLevel: c.perLevel ?? 20,
    levels: c.levels ?? 1,
    answerRole: c.answerRole,
    refRole: c.refRole,
    promptImageRole: c.promptImageRole,
    valueRole: c.valueRole,
    tmpl: c.tmpl,
    imageRole: c.imageRole,
    roles: c.roles,
  };
}

export async function loadGameMeta(slug: string): Promise<GameMeta | null> {
  const [game] = await db
    .select()
    .from(games)
    .where(and(eq(games.slug, slug), eq(games.status, "published")))
    .limit(1);
  if (!game) return null;
  return {
    gameId: game.id,
    slug: game.slug,
    mechanic: game.mechanic as Mechanic,
    title: game.title,
    style: (game.style ?? {}) as { emoji?: string },
    config: parseConfig(game.config),
    topicId: game.topicId,
  };
}

/**
 * Build decks for one difficulty level of any mechanic.
 * Entities are ranked famous → obscure; level N draws its QUESTIONS from
 * slice [(N-1)*perLevel, N*perLevel), distractors/pairs use the full pool.
 */
export async function loadGameDecks(
  slug: string,
  locale: string,
  seed: string,
  level = 1,
): Promise<GameDecks | null> {
  const meta = await loadGameMeta(slug);
  if (!meta) return null;
  const cfg = meta.config;

  const rows = await db
    .select()
    .from(topicEntities)
    .where(
      and(eq(topicEntities.topicId, meta.topicId), eq(topicEntities.excluded, false)),
    );

  const entities: DeckEntity[] = rows
    .map((r) => ({
      qid: r.wikidataQid,
      labels: r.labels,
      values: r.values as Record<string, unknown>,
      imageUrl: r.imageUrl,
      wikiLinks: r.wikiLinks,
      difficultyScore: r.difficultyScore,
    }))
    .sort((a, b) => (b.difficultyScore ?? 0) - (a.difficultyScore ?? 0));

  const lvl = Math.min(Math.max(1, level), cfg.levels);
  const questions = entities.slice((lvl - 1) * cfg.perLevel, lvl * cfg.perLevel);
  if (questions.length === 0) return null;

  const base = { locale, deckSize: cfg.deckSize, questions };
  const result: GameDecks = {
    ...meta,
    level: lvl,
    duelCards: [],
    quadCards: [],
    binaryCards: [],
  };

  if (meta.mechanic === "swipe_binary") {
    result.binaryCards = buildBinaryDeck(entities, {
      ...base,
      seed: `${slug}-L${lvl}-${seed}`,
      roles: cfg.roles ?? [],
    });
    return result;
  }

  if (meta.mechanic === "higher_lower") {
    result.duelCards = buildHigherLowerDeck(entities, {
      ...base,
      seed: `${slug}-L${lvl}-${seed}`,
      valueRole: cfg.valueRole ?? "population",
      tmpl: cfg.tmpl ?? "morePopulation",
      imageRole: cfg.imageRole,
    });
    return result;
  }

  // choice — relation variant
  if (cfg.refRole) {
    result.duelCards = buildRefChoiceDeck(entities, {
      ...base,
      seed: `${slug}-L${lvl}-duel-${seed}`,
      refRole: cfg.refRole,
      optionCount: 2,
      promptImageRole: cfg.promptImageRole,
    });
    result.quadCards = buildRefChoiceDeck(entities, {
      ...base,
      seed: `${slug}-L${lvl}-quad-${seed}`,
      refRole: cfg.refRole,
      optionCount: 4,
      promptImageRole: cfg.promptImageRole,
    });
    return result;
  }

  // choice — own attribute (flag / arms / logo)
  const role = cfg.answerRole ?? "flag";
  const withRole = entities.filter((e) => e.values[role] != null);
  const qWithRole = questions.filter((e) => e.values[role] != null);
  const image = (e: DeckEntity) => (e.values[role] as string | undefined) ?? undefined;
  const label = (e: DeckEntity) => e.labels[locale] ?? e.labels.en;

  result.duelCards = buildChoiceDeck(withRole, {
    ...base,
    questions: qWithRole,
    seed: `${slug}-L${lvl}-duel-${seed}`,
    optionCount: 2,
    prompt: (e) => ({ label: label(e) }),
    option: (e) => ({ image: image(e) }),
  });
  result.quadCards = buildChoiceDeck(withRole, {
    ...base,
    questions: qWithRole,
    seed: `${slug}-L${lvl}-quad-${seed}`,
    optionCount: 4,
    prompt: (e) => ({ image: image(e) }),
    option: (e) => ({ label: label(e) }),
  });
  return result;
}

/** Published games for the home catalog (safe: returns [] when the DB is empty/unreachable). */
export async function listPublishedGames() {
  try {
    const rows = await db
      .select({
        slug: games.slug,
        title: games.title,
        style: games.style,
        config: games.config,
        playsCount: games.playsCount,
      })
      .from(games)
      .where(eq(games.status, "published"));
    return rows.map((r) => ({ ...r, config: parseConfig(r.config) }));
  } catch {
    return [];
  }
}
