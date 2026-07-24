"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { challenges, games, invites, referrals, teamMembers, teams } from "@/db/schema";
import { getUser, makeToken } from "./session";

export interface SocialResult {
  ok: boolean;
  message: string;
}

function fail(err: unknown): string {
  const e = err as { cause?: { message?: string }; message?: string };
  const raw = (e?.cause?.message ?? e?.message ?? String(err)).trim();
  if (/does not exist/i.test(raw))
    return `${raw} — схоже, не застосовано міграцію: npm run db:migrate`;
  return raw.slice(0, 240);
}

/** True if the user belongs to the team (any role). */
async function isMember(teamId: string, userId: string): Promise<boolean> {
  const [m] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);
  return !!m;
}

/** Create a team; the creator becomes its owner-member. */
export async function createTeamAction(name: string): Promise<SocialResult & { teamId?: string }> {
  const u = await getUser();
  if (!u) return { ok: false, message: "Спершу увійди" };
  const n = name.trim();
  if (n.length < 2 || n.length > 40) return { ok: false, message: "Назва: 2–40 символів" };
  try {
    const [team] = await db.insert(teams).values({ name: n, ownerId: u.id }).returning();
    await db
      .insert(teamMembers)
      .values({ teamId: team.id, userId: u.id, role: "owner" })
      .onConflictDoNothing();
    revalidatePath("/team");
    return { ok: true, message: "команду створено", teamId: team.id };
  } catch (err) {
    return { ok: false, message: fail(err) };
  }
}

/** Rename a team (owner only). */
export async function renameTeamAction(teamId: string, name: string): Promise<SocialResult> {
  const u = await getUser();
  if (!u) return { ok: false, message: "Спершу увійди" };
  const n = name.trim();
  if (n.length < 2 || n.length > 40) return { ok: false, message: "Назва: 2–40 символів" };
  try {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) return { ok: false, message: "команду не знайдено" };
    if (team.ownerId !== u.id) return { ok: false, message: "лише власник може перейменувати" };
    await db.update(teams).set({ name: n }).where(eq(teams.id, teamId));
    revalidatePath(`/team/${teamId}`);
    revalidatePath("/team");
    return { ok: true, message: "перейменовано" };
  } catch (err) {
    return { ok: false, message: fail(err) };
  }
}

/** Owner deletes the team (memberships/invites cascade). */
export async function deleteTeamAction(teamId: string): Promise<SocialResult> {
  const u = await getUser();
  if (!u) return { ok: false, message: "Спершу увійди" };
  try {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) return { ok: false, message: "команду не знайдено" };
    if (team.ownerId !== u.id) return { ok: false, message: "лише власник може видалити" };
    await db.delete(teams).where(eq(teams.id, teamId));
    revalidatePath("/team");
    return { ok: true, message: "команду видалено" };
  } catch (err) {
    return { ok: false, message: fail(err) };
  }
}

/** Leave a team (non-owner). The owner must delete instead. */
export async function leaveTeamAction(teamId: string): Promise<SocialResult> {
  const u = await getUser();
  if (!u) return { ok: false, message: "Спершу увійди" };
  try {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) return { ok: false, message: "команду не знайдено" };
    if (team.ownerId === u.id)
      return { ok: false, message: "власник не може вийти — видали команду" };
    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, u.id)));
    revalidatePath("/team");
    return { ok: true, message: "ти вийшов з команди" };
  } catch (err) {
    return { ok: false, message: fail(err) };
  }
}

/** Create (or reuse) an invite token for a team the user belongs to. */
export async function createInviteAction(
  teamId: string,
): Promise<SocialResult & { token?: string }> {
  const u = await getUser();
  if (!u) return { ok: false, message: "Спершу увійди" };
  try {
    if (!(await isMember(teamId, u.id)))
      return { ok: false, message: "ти не в цій команді" };
    const token = makeToken();
    await db.insert(invites).values({ token, teamId, inviterId: u.id });
    revalidatePath(`/team/${teamId}`);
    return { ok: true, message: "лінк створено", token };
  } catch (err) {
    return { ok: false, message: fail(err) };
  }
}

/**
 * Accept an invite: join the team and record the referral (once per user).
 * Called from the /join landing after the user is logged in.
 */
export async function acceptInviteAction(
  token: string,
): Promise<SocialResult & { teamId?: string }> {
  const u = await getUser();
  if (!u) return { ok: false, message: "Спершу зареєструйся або увійди" };
  try {
    const [inv] = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
    if (!inv) return { ok: false, message: "лінк недійсний" };
    if (inv.expiresAt && inv.expiresAt.getTime() < Date.now())
      return { ok: false, message: "термін дії лінку минув" };

    const [team] = await db.select().from(teams).where(eq(teams.id, inv.teamId)).limit(1);
    if (!team) return { ok: false, message: "команди більше немає" };

    if (u.id === team.ownerId || (await isMember(inv.teamId, u.id)))
      return { ok: true, message: "ти вже в команді", teamId: inv.teamId };

    await db
      .insert(teamMembers)
      .values({ teamId: inv.teamId, userId: u.id, role: "member" })
      .onConflictDoNothing();

    // referral is provenance — recorded once, on the first team a user joins
    await db
      .insert(referrals)
      .values({ userId: u.id, invitedByUserId: inv.inviterId, teamId: inv.teamId })
      .onConflictDoNothing();

    revalidatePath(`/team/${inv.teamId}`);
    revalidatePath("/team");
    return { ok: true, message: `ти приєднався до «${team.name}»`, teamId: inv.teamId };
  } catch (err) {
    return { ok: false, message: fail(err) };
  }
}

/**
 * Throw a challenge on a game (optionally to a team): stores game + a fresh
 * seed under a token, shared as /challenge?ch=<token>.
 */
export async function createChallengeAction(
  gameSlug: string,
  teamId?: string,
): Promise<SocialResult & { token?: string }> {
  const u = await getUser();
  if (!u) return { ok: false, message: "Спершу увійди" };
  try {
    const [game] = await db.select().from(games).where(eq(games.slug, gameSlug)).limit(1);
    if (!game) return { ok: false, message: "гру не знайдено" };
    if (teamId && !(await isMember(teamId, u.id)))
      return { ok: false, message: "ти не в цій команді" };
    const token = makeToken();
    await db.insert(challenges).values({
      token,
      gameId: game.id,
      seed: makeToken(),
      authorId: u.id,
      ...(teamId ? { teamId } : {}),
    });
    return { ok: true, message: "челендж створено", token };
  } catch (err) {
    return { ok: false, message: fail(err) };
  }
}
