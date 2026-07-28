"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, topics } from "@/db/schema";
import type { LocalizedText } from "@/i18n/locales";

export interface GameHit {
  slug: string;
  title: LocalizedText;
  cover?: string;
  icon?: string;
}

const LIMIT = 6;

/**
 * Typeahead over PUBLISHED games only — the home box is a shortcut into play,
 * not the full catalogue search (that one lives on /categories and also covers
 * categories).
 *
 * Matches the localized titles and the slug. Ordered by plays so the obvious
 * answer to a short prefix is the popular one.
 */
export async function searchGamesAction(query: string): Promise<GameHit[]> {
  const q = query.trim();
  if (q.length < 2) return []; // one letter would match nearly everything
  const like = `%${q}%`;

  try {
    const rows = await db
      .select({ slug: games.slug, title: games.title, style: games.style })
      .from(games)
      .innerJoin(topics, eq(topics.id, games.topicId))
      .where(
        and(
          eq(games.status, "published"),
          sql`(${games.title}->>'uk' ILIKE ${like} OR ${games.title}->>'en' ILIKE ${like} OR ${games.slug} ILIKE ${like})`,
        ),
      )
      .orderBy(desc(games.playsCount))
      .limit(LIMIT);

    return rows.map((r) => {
      const style = (r.style ?? {}) as { cover?: string; icon?: string };
      return { slug: r.slug, title: r.title, cover: style.cover, icon: style.icon };
    });
  } catch {
    return [];
  }
}
