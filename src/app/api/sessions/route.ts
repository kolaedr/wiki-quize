import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, sessions } from "@/db/schema";
import { auth } from "@/lib/auth";

/** Persist a finished play-through. Guests are recorded with userId = null. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    gameId?: string;
    seed?: string;
    score?: number;
    answers?: { key: string; correct: boolean }[];
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

  try {
    await db.insert(sessions).values({
      gameId: body.gameId,
      userId,
      seed: body.seed ?? "",
      score: Math.max(0, Math.min(100_000, Math.round(body.score))),
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

  return NextResponse.json({ ok: true });
}
