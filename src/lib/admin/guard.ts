import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

/**
 * Staff levels:
 *  - "super": full access (generation, datasets, users…). Granted by
 *    user.role === "admin" OR the email being in ADMIN_EMAILS (env bootstrap).
 *  - "moderator": trusted editor. Granted by user.role === "moderator". Can only
 *    tidy games (toggle on/off, rename, change icon) — no generation, no datasets.
 */
export type StaffLevel = "super" | "moderator";

type SessionLike = Awaited<ReturnType<typeof auth.api.getSession>>;

async function currentSession(): Promise<NonNullable<SessionLike> | null> {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  return session ?? null;
}

/** Which staff level (if any) this user has (role + email from DB when possible). */
function levelOf(user: { role?: string | null; email: string }): StaffLevel | null {
  const role = user.role ?? undefined;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (role === "admin" || allowlist.includes(user.email.toLowerCase())) return "super";
  if (role === "moderator") return "moderator";
  return null;
}

async function staffUserFromSession(session: NonNullable<SessionLike>) {
  const row = await db
    .select({ role: userTable.role, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .then((r) => r[0]);

  return {
    role: row?.role ?? session.user.role,
    email: row?.email ?? session.user.email,
  };
}

/**
 * SUPER-ADMIN gate (unchanged contract): returns the session only for supers.
 * Every generation / dataset / user-management action uses this.
 */
export async function getAdminSession() {
  const session = await currentSession();
  if (!session) return null;
  const user = await staffUserFromSession(session);
  return levelOf(user) === "super" ? session : null;
}

/** Any staff member (super OR moderator) + their level. Null for everyone else. */
export async function getStaff(): Promise<
  { session: NonNullable<SessionLike>; level: StaffLevel } | null
> {
  const session = await currentSession();
  if (!session) return null;
  const user = await staffUserFromSession(session);
  const level = levelOf(user);
  return level ? { session, level } : null;
}

/** True when the current session is a super-admin (for conditional actions). */
export async function isSuper(): Promise<boolean> {
  return (await getStaff())?.level === "super";
}

/**
 * Page guard for super-only admin pages: kicks guests to the site and
 * moderators to the one page they may use (the games list).
 */
export async function requireSuperPage() {
  const staff = await getStaff();
  if (!staff) redirect("/");
  if (staff.level !== "super") redirect("/admin/games");
  return staff.session;
}
