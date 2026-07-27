import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, games, topicEntities, topics } from "@/db/schema";
import type { LocalizedText } from "@/i18n/locales";
import {
  buildBinaryDeck,
  buildChoiceDeck,
  buildHigherLowerDeck,
  buildRefChoiceDeck,
  buildRefParentDeck,
  buildSingleAttrDeck,
  buildSingleRefDeck,
  refsOf,
  showVisual,
} from "./build";
import type { BinaryCard, ChoiceCard, DeckEntity } from "./types";

export type Mechanic = "choice" | "higher_lower" | "swipe_binary" | "timeline_ribbon" | "odd_one_out";

export interface GameConfig {
  deckSize: number;
  perLevel: number;
  levels: number;
  /** choice: own image attribute (flag/arms/logo) */
  answerRole?: string;
  /** choice (own attr): force the QUESTION to be the image, options = text —
   *  in every layout (else duel shows the name and the image is the option). */
  promptImage?: boolean;
  /** how the QUESTION renders: text | image | both (overrides promptImage) */
  promptShow?: "text" | "image" | "both";
  /** how each ANSWER option renders: text | image | both */
  optionShow?: "text" | "image" | "both";
  /** choice over a relation: values[refRole] = [{qid, labels}] */
  refRole?: string;
  /** "parent" = reverse direction: prompt is the ref (brand), options are entities (models) */
  refDirection?: "parent";
  promptImageRole?: string;
  /** higher_lower */
  valueRole?: string;
  tmpl?: string;
  imageRole?: string;
  /** swipe_binary */
  roles?: { role: string; tmpl: string }[];
  /** choice: template for the SINGLE (true/false) layout, e.g. "isFlag", "langOf" */
  singleTmpl?: string;
  /** choice: emoji-content fallback role for broken images (e.g. flagEmoji) */
  emojiRole?: string;
  /** choice over a plain text attribute (element symbol, ISO code…) */
  textRole?: string;
  /** text quiz direction: false = name→value (default), true = value→name */
  textAsPrompt?: boolean;
}

export interface GameMeta {
  gameId: string;
  slug: string;
  mechanic: Mechanic;
  title: LocalizedText;
  style: { emoji?: string };
  config: GameConfig;
  topicId: string;
  topic: { slug: string; title: LocalizedText };
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
    promptImage: c.promptImage,
    promptShow: c.promptShow,
    optionShow: c.optionShow,
    refRole: c.refRole,
    refDirection: c.refDirection,
    promptImageRole: c.promptImageRole,
    valueRole: c.valueRole,
    tmpl: c.tmpl,
    imageRole: c.imageRole,
    roles: c.roles,
    singleTmpl: c.singleTmpl,
    emojiRole: c.emojiRole,
    textRole: c.textRole,
    textAsPrompt: c.textAsPrompt,
  };
}

export async function loadGameMeta(
  slug: string,
  includeUnlisted = false,
): Promise<GameMeta | null> {
  const [row] = await db
    .select({ game: games, topicSlug: topics.slug, topicTitle: topics.title })
    .from(games)
    .innerJoin(topics, eq(topics.id, games.topicId))
    .where(
      and(
        eq(games.slug, slug),
        includeUnlisted
          ? inArray(games.status, ["published", "unlisted"])
          : eq(games.status, "published"),
      ),
    )
    .limit(1);
  if (!row) return null;
  const game = row.game;
  return {
    gameId: game.id,
    slug: game.slug,
    mechanic: game.mechanic as Mechanic,
    title: game.title,
    style: (game.style ?? {}) as { emoji?: string },
    config: parseConfig(game.config),
    topicId: game.topicId,
    topic: { slug: row.topicSlug, title: row.topicTitle },
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
  includeUnlisted = false,
): Promise<GameDecks | null> {
  const meta = await loadGameMeta(slug, includeUnlisted);
  if (!meta) return null;
  const cfg = meta.config;

  const rows = await db
    .select()
    .from(topicEntities)
    .where(
      and(eq(topicEntities.topicId, meta.topicId), eq(topicEntities.excluded, false)),
    );

  const all: DeckEntity[] = rows
    .map((r) => ({
      qid: r.wikidataQid,
      labels: r.labels,
      values: r.values as Record<string, unknown>,
      imageUrl: r.imageUrl,
      wikiLinks: r.wikiLinks,
      difficultyScore: r.difficultyScore,
    }))
    .sort((a, b) => (b.difficultyScore ?? 0) - (a.difficultyScore ?? 0));

  // ELIGIBLE entities for THIS game — levels are sliced over these, not over
  // the whole topic (otherwise a level of famous countries that lost e.g.
  // their arms image in validation produces an empty deck → 404).
  let entities: DeckEntity[];
  if (meta.mechanic === "swipe_binary") {
    entities = all.filter((e) =>
      (cfg.roles ?? []).some((r) => Number.isFinite(Number(e.values[r.role]))),
    );
  } else if (meta.mechanic === "higher_lower") {
    const role = cfg.valueRole ?? "population";
    entities = all.filter((e) => Number.isFinite(Number(e.values[role])) && Number(e.values[role]) > 0);
  } else if (cfg.refRole) {
    entities = all.filter((e) => refsOf(e, cfg.refRole!).length > 0);
  } else if (cfg.textRole) {
    const role = cfg.textRole;
    entities = all.filter((e) => {
      const v = e.values[role];
      return typeof v === "string" && v.trim().length > 0;
    });
  } else {
    const role = cfg.answerRole ?? "flag";
    entities = all.filter((e) => e.values[role] != null);
  }

  const maxLevels = Math.max(1, Math.ceil(entities.length / cfg.perLevel));
  const lvl = Math.min(Math.max(1, level), Math.min(cfg.levels, maxLevels));
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
    if (cfg.refDirection === "parent") {
      // reverse: prompt = the parent (brand "Audi"), options = its/others' models
      result.duelCards = buildRefParentDeck(entities, {
        ...base,
        seed: `${slug}-L${lvl}-duel-${seed}`,
        refRole: cfg.refRole,
        optionCount: 2,
      });
      result.quadCards = buildRefParentDeck(entities, {
        ...base,
        seed: `${slug}-L${lvl}-quad-${seed}`,
        refRole: cfg.refRole,
        optionCount: 4,
      });
      return result;
    }
    result.duelCards = buildRefChoiceDeck(entities, {
      ...base,
      seed: `${slug}-L${lvl}-duel-${seed}`,
      refRole: cfg.refRole,
      optionCount: 2,
      promptImageRole: cfg.promptImageRole,
      promptShow: cfg.promptShow,
      optionShow: cfg.optionShow,
    });
    result.quadCards = buildRefChoiceDeck(entities, {
      ...base,
      seed: `${slug}-L${lvl}-quad-${seed}`,
      refRole: cfg.refRole,
      optionCount: 4,
      promptImageRole: cfg.promptImageRole,
      promptShow: cfg.promptShow,
      optionShow: cfg.optionShow,
    });
    if (cfg.singleTmpl) {
      result.binaryCards = buildSingleRefDeck(entities, {
        ...base,
        seed: `${slug}-L${lvl}-single-${seed}`,
        refRole: cfg.refRole,
        tmpl: cfg.singleTmpl,
        promptImageRole: cfg.promptImageRole,
      });
    }
    return result;
  }

  // choice — a plain TEXT attribute (element symbol, ISO code, motto…). Both
  // sides are labels: name→value ("which symbol is Iron?") or, reversed,
  // value→name ("Fe is which element?"). No images, so duel + quad only.
  if (cfg.textRole) {
    const trole = cfg.textRole;
    const hasText = (e: DeckEntity) => {
      const v = e.values[trole];
      return typeof v === "string" && v.trim().length > 0;
    };
    const withText = entities.filter(hasText);
    const qWithText = questions.filter(hasText);
    const text = (e: DeckEntity) => String(e.values[trole] ?? "").trim();
    const name = (e: DeckEntity) => e.labels[locale] ?? e.labels.en ?? e.qid;
    const promptFn = cfg.textAsPrompt
      ? (e: DeckEntity) => ({ label: text(e) })
      : (e: DeckEntity) => ({ label: name(e) });
    const optionFn = cfg.textAsPrompt
      ? (e: DeckEntity) => ({ label: name(e) })
      : (e: DeckEntity) => ({ label: text(e) });

    result.duelCards = buildChoiceDeck(withText, {
      ...base,
      questions: qWithText,
      seed: `${slug}-L${lvl}-duel-${seed}`,
      optionCount: 2,
      prompt: promptFn,
      option: optionFn,
    });
    result.quadCards = buildChoiceDeck(withText, {
      ...base,
      questions: qWithText,
      seed: `${slug}-L${lvl}-quad-${seed}`,
      optionCount: 4,
      prompt: promptFn,
      option: optionFn,
    });
    return result;
  }

  // choice — own attribute (flag / arms / logo)
  const role = cfg.answerRole ?? "flag";
  const withRole = entities.filter((e) => e.values[role] != null);
  const qWithRole = questions.filter((e) => e.values[role] != null);
  const image = (e: DeckEntity) => (e.values[role] as string | undefined) ?? undefined;
  const label = (e: DeckEntity) => e.labels[locale] ?? e.labels.en;

  // Admin-chosen presentation (text|image|both) — applied consistently to every
  // layout. Falls back to the legacy promptImage swap when not configured.
  const pShow = cfg.promptShow;
  const oShow = cfg.optionShow;
  const promptDuel = pShow
    ? (e: DeckEntity) => showVisual(pShow, label(e), image(e))
    : cfg.promptImage
      ? (e: DeckEntity) => ({ image: image(e) })
      : (e: DeckEntity) => ({ label: label(e) });
  const optionDuel = oShow
    ? (e: DeckEntity) => showVisual(oShow, label(e), image(e))
    : cfg.promptImage
      ? (e: DeckEntity) => ({ label: label(e) })
      : (e: DeckEntity) => ({ image: image(e) });
  const promptQuad = pShow ? (e: DeckEntity) => showVisual(pShow, label(e), image(e)) : (e: DeckEntity) => ({ image: image(e) });
  const optionQuad = oShow ? (e: DeckEntity) => showVisual(oShow, label(e), image(e)) : (e: DeckEntity) => ({ label: label(e) });

  result.duelCards = buildChoiceDeck(withRole, {
    ...base,
    questions: qWithRole,
    seed: `${slug}-L${lvl}-duel-${seed}`,
    optionCount: 2,
    prompt: promptDuel,
    option: optionDuel,
  });
  result.quadCards = buildChoiceDeck(withRole, {
    ...base,
    questions: qWithRole,
    seed: `${slug}-L${lvl}-quad-${seed}`,
    optionCount: 4,
    prompt: promptQuad,
    option: optionQuad,
  });
  if (cfg.singleTmpl) {
    result.binaryCards = buildSingleAttrDeck(withRole, {
      ...base,
      questions: qWithRole,
      seed: `${slug}-L${lvl}-single-${seed}`,
      imageRole: role,
      tmpl: cfg.singleTmpl,
      emojiRole: cfg.emojiRole,
    });
  }
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

export interface CatalogEntry {
  /** category slug OR (for uncategorized datasets) the topic slug */
  slug: string;
  title: LocalizedText;
  icon?: string;
  /** category cover image (from an item), shown instead of the icon */
  image?: string;
  gamesCount: number;
  kind: "category" | "topic";
}

/**
 * Home catalog. CATEGORIES (each aggregating the published games of all its
 * datasets) come first, then any published dataset NOT yet assigned to a
 * category — so seeds stay visible during the migration to structured content.
 */
export async function listCategories(): Promise<CatalogEntry[]> {
  try {
    const [cats, loose] = await Promise.all([
      db
        .select({
          slug: categories.slug,
          title: categories.title,
          icon: categories.icon,
          image: categories.image,
          sortOrder: categories.sortOrder,
          gamesCount: sql<number>`count(${games.id})::int`,
        })
        .from(categories)
        .leftJoin(topics, eq(topics.categoryId, categories.id))
        .leftJoin(games, and(eq(games.topicId, topics.id), eq(games.status, "published")))
        .groupBy(categories.id)
        .orderBy(categories.sortOrder),
      db
        .select({
          slug: topics.slug,
          title: topics.title,
          sourceConfig: topics.sourceConfig,
          gamesCount: sql<number>`count(${games.id})::int`,
        })
        .from(topics)
        .leftJoin(games, and(eq(games.topicId, topics.id), eq(games.status, "published")))
        .where(and(eq(topics.status, "published"), isNull(topics.categoryId)))
        .groupBy(topics.id)
        .orderBy(desc(sql`count(${games.id})`)),
    ]);

    return [
      ...cats
        .filter((c) => c.gamesCount > 0)
        .map((c) => ({
          slug: c.slug,
          title: c.title,
          icon: c.icon ?? undefined,
          image: c.image ?? undefined,
          gamesCount: c.gamesCount,
          kind: "category" as const,
        })),
      ...loose
        .filter((tp) => tp.gamesCount > 0)
        .map((tp) => ({
          slug: tp.slug,
          title: tp.title,
          icon: (tp.sourceConfig as { icon?: string })?.icon,
          gamesCount: tp.gamesCount,
          kind: "topic" as const,
        })),
    ];
  } catch {
    return [];
  }
}

export interface ContentStats {
  /** playable question pool: non-excluded items of topics behind a published game */
  items: number;
  games: number;
}

/**
 * Headline numbers for the home banner. "Questions" deliberately counts only
 * items that can actually show up in play — excluded items and datasets with no
 * published game aren't available to anyone, so counting them would overstate.
 */
export async function getContentStats(): Promise<ContentStats> {
  try {
    const publishedTopics = db
      .selectDistinct({ topicId: games.topicId })
      .from(games)
      .where(eq(games.status, "published"));

    const [[items], [gamesRow]] = await Promise.all([
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(topicEntities)
        .where(
          and(eq(topicEntities.excluded, false), inArray(topicEntities.topicId, publishedTopics)),
        ),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(games)
        .where(eq(games.status, "published")),
    ]);
    return { items: items?.n ?? 0, games: gamesRow?.n ?? 0 };
  } catch {
    return { items: 0, games: 0 };
  }
}

export const PAGE_SIZE = 10;

export interface CategoryNode {
  id: string;
  slug: string;
  title: LocalizedText;
  icon?: string;
  image?: string;
  parentId: string | null;
  /** published games across the WHOLE subtree (this category + all descendants) */
  gamesCount: number;
}

/**
 * All categories with SUBTREE game counts — two queries total (categories +
 * direct game counts), the tree math is in-memory. Parents aggregate their
 * children so a top-level category reflects everything nested under it.
 */
export async function categoryNodes(): Promise<CategoryNode[]> {
  const [cats, counts] = await Promise.all([
    db
      .select({
        id: categories.id,
        slug: categories.slug,
        title: categories.title,
        icon: categories.icon,
        image: categories.image,
        parentId: categories.parentId,
        sortOrder: categories.sortOrder,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder)),
    db
      .select({ catId: topics.categoryId, n: sql<number>`count(${games.id})::int` })
      .from(games)
      .innerJoin(topics, eq(topics.id, games.topicId))
      .where(eq(games.status, "published"))
      .groupBy(topics.categoryId),
  ]);
  const direct = new Map<string, number>();
  for (const c of counts) if (c.catId) direct.set(c.catId, c.n);
  const kids = new Map<string, string[]>();
  for (const c of cats)
    if (c.parentId) kids.set(c.parentId, [...(kids.get(c.parentId) ?? []), c.id]);
  const subtree = (id: string): number =>
    (direct.get(id) ?? 0) + (kids.get(id) ?? []).reduce((s, cid) => s + subtree(cid), 0);
  return cats.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    icon: c.icon ?? undefined,
    image: c.image ?? undefined,
    parentId: c.parentId,
    gamesCount: subtree(c.id),
  }));
}

interface CatalogPage {
  title: LocalizedText;
  icon?: string;
  image?: string;
  page: number;
  hasNext: boolean;
  /** direct subcategories (with subtree counts) — drives the drill-down */
  children: { slug: string; title: LocalizedText; icon?: string; image?: string; gamesCount: number }[];
  items: {
    slug: string;
    title: LocalizedText;
    style: unknown;
    config: GameConfig;
    playsCount: number;
  }[];
}

const gameCols = {
  slug: games.slug,
  title: games.title,
  style: games.style,
  config: games.config,
  playsCount: games.playsCount,
} as const;

/**
 * Catalog page for a slug that is EITHER a category (all its datasets' games)
 * or an uncategorized dataset/topic. Every DB list is paginated.
 */
export async function loadCategoryPage(slug: string, page = 1): Promise<CatalogPage | null> {
  const p = Math.max(1, page);

  // 1) category slug → games across all its published datasets
  const [cat] = await db
    .select({ id: categories.id, title: categories.title, icon: categories.icon, image: categories.image })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  if (cat) {
    const [topicRows, nodes] = await Promise.all([
      db
        .select({ id: topics.id })
        .from(topics)
        .where(and(eq(topics.categoryId, cat.id), eq(topics.status, "published"))),
      categoryNodes(),
    ]);
    const ids = topicRows.map((r) => r.id);
    const rows = ids.length
      ? await db
          .select(gameCols)
          .from(games)
          .where(and(inArray(games.topicId, ids), eq(games.status, "published")))
          .orderBy(desc(games.playsCount), games.slug)
          .limit(PAGE_SIZE + 1)
          .offset((p - 1) * PAGE_SIZE)
      : [];
    const children = nodes
      .filter((n) => n.parentId === cat.id)
      .sort((a, b) => b.gamesCount - a.gamesCount)
      .map((n) => ({ slug: n.slug, title: n.title, icon: n.icon, image: n.image, gamesCount: n.gamesCount }));
    return {
      title: cat.title,
      icon: cat.icon ?? undefined,
      image: cat.image ?? undefined,
      page: p,
      hasNext: rows.length > PAGE_SIZE,
      children,
      items: rows.slice(0, PAGE_SIZE).map((r) => ({ ...r, config: parseConfig(r.config) })),
    };
  }

  // 2) fallback: an uncategorized dataset addressed by its own slug
  const [topic] = await db
    .select({ id: topics.id, title: topics.title, sourceConfig: topics.sourceConfig })
    .from(topics)
    .where(and(eq(topics.slug, slug), eq(topics.status, "published")))
    .limit(1);
  if (!topic) return null;

  const rows = await db
    .select(gameCols)
    .from(games)
    .where(and(eq(games.topicId, topic.id), eq(games.status, "published")))
    .orderBy(desc(games.playsCount), games.slug)
    .limit(PAGE_SIZE + 1)
    .offset((p - 1) * PAGE_SIZE);

  return {
    title: topic.title,
    icon: (topic.sourceConfig as { icon?: string })?.icon,
    page: p,
    hasNext: rows.length > PAGE_SIZE,
    children: [],
    items: rows.slice(0, PAGE_SIZE).map((r) => ({ ...r, config: parseConfig(r.config) })),
  };
}
