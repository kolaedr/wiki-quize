import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { gameProgress } from "@/db/schema";

/** Best rating per level for one user+game: { 1: 3, 2: 2, … }. */
export type LevelStars = Record<number, number>;

/**
 * Account-side progress for a game. Guests get an empty map and fall back to
 * their localStorage progress — signing in should ADD history, never hide it.
 */
export async function getGameProgress(
  userId: string | null | undefined,
  gameId: string,
): Promise<LevelStars> {
  if (!userId) return {};
  try {
    const rows = await db
      .select({ level: gameProgress.level, stars: gameProgress.stars })
      .from(gameProgress)
      .where(and(eq(gameProgress.userId, userId), eq(gameProgress.gameId, gameId)));
    return Object.fromEntries(rows.map((r) => [r.level, r.stars])) as LevelStars;
  } catch {
    // a missing table (migration not applied yet) must not 500 the level map
    return {};
  }
}

/**
 * Record a CLEARED level. One row per (user, game, level) that only improves:
 * stars and bestScore take the max, attempts counts the clears. The raw
 * per-answer history stays in `sessions` — this is just the aggregate the
 * level map reads.
 */
export async function saveLevelClear(params: {
  userId: string;
  gameId: string;
  level: number;
  stars: number;
  score: number;
}) {
  const level = Math.max(1, Math.round(params.level));
  const stars = Math.max(0, Math.min(3, Math.round(params.stars)));
  const score = Math.max(0, Math.min(100_000, Math.round(params.score)));

  await db
    .insert(gameProgress)
    .values({
      userId: params.userId,
      gameId: params.gameId,
      level,
      stars,
      bestScore: score,
      attempts: 1,
    })
    .onConflictDoUpdate({
      target: [gameProgress.userId, gameProgress.gameId, gameProgress.level],
      set: {
        stars: sql`greatest(${gameProgress.stars}, excluded.stars)`,
        bestScore: sql`greatest(${gameProgress.bestScore}, excluded.best_score)`,
        attempts: sql`${gameProgress.attempts} + 1`,
        updatedAt: sql`now()`,
      },
    });
}
