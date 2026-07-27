import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, sessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { saveLevelClear } from "@/lib/progress/server";

/** Persist a finished play-through. Guests are recorded with userId = null. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    gameId?: string;
    seed?: string;
    score?: number;
    answers?: { key: string; correct: boolean }[];
    /** which level was played (level-based games) */
    level?: number;
    /** lives left at the end = 0..3 rating; 0 means the level was failed */
    stars?: number;
  } | null;

  if (!body?.gameId || typeof body.score !== "number" || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // Attach the user when signed in (guests play anonymously)
  let userId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    userId = session?.user.id ?? null;
  } catch {
    /* auth unavailable → guest */
  }

  const level =
    Number.isFinite(body.level) && Number(body.level) > 0 ? Math.round(Number(body.level)) : null;
  const stars =
    Number.isFinite(body.stars) ? Math.max(0, Math.min(3, Math.round(Number(body.stars)))) : null;
  const score = Math.max(0, Math.min(100_000, Math.round(body.score)));

  try {
    await db.insert(sessions).values({
      gameId: body.gameId,
      userId,
      seed: body.seed ?? "",
      score,
      level,
      stars,
      answers: body.answers.slice(0, 50),
      finishedAt: new Date(),
    });
    await db
      .update(games)
      .set({ playsCount: sql`${games.playsCount} + 1` })
      .where(eq(games.id, body.gameId));
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Aggregate for the level map — signed-in users only, and only for a level
  // that was actually CLEARED (stars > 0). Failing it changes nothing.
  if (userId && level && stars && stars > 0) {
    try {
      await saveLevelClear({ userId, gameId: body.gameId, level, stars, score });
    } catch {
      // the play-through itself is already saved — don't fail the request
    }
  }

  return NextResponse.json({ ok: true });
}
