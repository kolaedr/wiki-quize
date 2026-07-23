import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { games, topicEntities, topics } from "@/db/schema";
import type { LocalizedText } from "@/i18n/locales";
import { autoGamesFor, type TopicDef } from "@/lib/ingest/def";
import { STARTER_GAMES } from "@/lib/ingest/run";

/**
 * PAIR COMPOSER (pipeline v2, step 3). Instead of auto-creating every possible
 * game, propose them from a dataset's fields with an item forecast, so the
 * admin picks + names the ones worth publishing. For relation (entityRef)
 * games it also detects WHICH sibling dataset in the same category the refs
 * point to — that's "how datasets link into a game".
 */
export interface GameProposal {
  slug: string;
  titleEn: string;
  titleUk: string;
  mechanic: string;
  icon: string;
  /** playable items forecast (entities that carry the game's role) */
  predictedItems: number;
  exists: boolean;
  existingStatus?: string;
  /** for ref games: the sibling dataset the references resolve to */
  linkToSlug?: string;
  linkToTitle?: string;
}

const cfgRole = (cfg: Record<string, unknown>, key: string) =>
  typeof cfg[key] === "string" ? (cfg[key] as string) : undefined;

export async function proposeGamesForTopic(
  topicSlug: string,
  locale = "uk",
): Promise<{ topicTitle: LocalizedText; proposals: GameProposal[] } | null> {
  const [topic] = await db.select().from(topics).where(eq(topics.slug, topicSlug)).limit(1);
  if (!topic) return null;

  const sc = topic.sourceConfig as { def?: TopicDef; preset?: string } | null;
  const specs = sc?.def
    ? autoGamesFor(sc.def)
    : sc?.preset
      ? (STARTER_GAMES[sc.preset] ?? [])
      : [];
  if (specs.length === 0) return { topicTitle: topic.title, proposals: [] };

  const entities = await db
    .select({ values: topicEntities.values })
    .from(topicEntities)
    .where(and(eq(topicEntities.topicId, topic.id), eq(topicEntities.excluded, false)));

  const roleCount = (role?: string) =>
    role
      ? entities.filter((e) => {
          const v = (e.values as Record<string, unknown>)[role];
          return v != null && (!Array.isArray(v) || v.length > 0);
        }).length
      : entities.length;

  const existing = await db
    .select({ slug: games.slug, status: games.status })
    .from(games)
    .where(eq(games.topicId, topic.id));
  const statusBySlug = new Map(existing.map((g) => [g.slug, g.status]));

  // siblings in the same category — potential link targets for ref games
  const siblings = topic.categoryId
    ? await db
        .select({ id: topics.id, slug: topics.slug, title: topics.title })
        .from(topics)
        .where(and(eq(topics.categoryId, topic.categoryId), ne(topics.id, topic.id)))
    : [];

  async function linkFor(role: string) {
    if (siblings.length === 0) return undefined;
    const qids = new Set<string>();
    for (const e of entities) {
      const v = (e.values as Record<string, unknown>)[role];
      if (Array.isArray(v)) {
        for (const x of v) {
          const q = typeof x === "string" ? x : (x as { qid?: string })?.qid;
          if (q) qids.add(q);
          if (qids.size >= 60) break;
        }
      }
      if (qids.size >= 60) break;
    }
    if (qids.size === 0) return undefined;
    const matches = await db
      .select({ topicId: topicEntities.topicId })
      .from(topicEntities)
      .where(
        and(
          inArray(
            topicEntities.topicId,
            siblings.map((s) => s.id),
          ),
          inArray(topicEntities.wikidataQid, [...qids]),
        ),
      );
    if (matches.length === 0) return undefined;
    const byTopic = new Map<string, number>();
    for (const m of matches) byTopic.set(m.topicId, (byTopic.get(m.topicId) ?? 0) + 1);
    let bestId: string | undefined;
    let bestN = 0;
    for (const [tid, n] of byTopic) if (n > bestN) ((bestN = n), (bestId = tid));
    return siblings.find((s) => s.id === bestId);
  }

  const proposals: GameProposal[] = [];
  for (const g of specs) {
    const refRole = cfgRole(g.config, "refRole");
    const link = refRole ? await linkFor(refRole) : undefined;
    proposals.push({
      slug: g.slug,
      titleEn: g.title.en ?? g.slug,
      titleUk: g.title.uk ?? g.title.en ?? g.slug,
      mechanic: g.mechanic,
      icon: g.icon,
      predictedItems: roleCount(g.countRole),
      exists: statusBySlug.has(g.slug),
      existingStatus: statusBySlug.get(g.slug),
      linkToSlug: link?.slug,
      linkToTitle: link
        ? (link.title[locale] ?? link.title.en ?? Object.values(link.title)[0])
        : undefined,
    });
  }
  return { topicTitle: topic.title, proposals };
}
