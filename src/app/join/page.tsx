import Link from "next/link";
import { eq } from "drizzle-orm";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExternalOpen } from "@/components/social/external-open";
import { JoinPanel } from "@/components/social/join-panel";
import { db } from "@/db";
import { invites, teams } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { getUser } from "@/lib/social/session";

export const dynamic = "force-dynamic";

/** Invite landing (/join?inv=<token>): join the team, register if needed. */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ inv?: string }>;
}) {
  const { inv } = await searchParams;
  const token = (inv ?? "").trim();
  const me = await getUser();

  const shell = (children: React.ReactNode) => (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-8">
      <div className="glass-card flex w-full max-w-sm flex-col gap-4 p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Users size={24} />
        </span>
        {children}
      </div>
    </main>
  );

  if (!token) return shell(<p className="text-sm text-muted">Лінк без токена запрошення.</p>);

  const [inv2] = await db
    .select({
      teamId: invites.teamId,
      expiresAt: invites.expiresAt,
      teamName: teams.name,
      inviter: user.name,
    })
    .from(invites)
    .innerJoin(teams, eq(teams.id, invites.teamId))
    .leftJoin(user, eq(user.id, invites.inviterId))
    .where(eq(invites.token, token))
    .limit(1);

  if (!inv2)
    return shell(
      <>
        <p className="text-sm font-semibold">Лінк недійсний</p>
        <p className="text-xs text-muted">Можливо, команду видалили або лінк застарів.</p>
        <Button asChild variant="ghost" size="sm">
          <Link href="/">На головну</Link>
        </Button>
      </>,
    );

  if (inv2.expiresAt && inv2.expiresAt.getTime() < Date.now())
    return shell(<p className="text-sm text-muted">Термін дії цього запрошення минув.</p>);

  return shell(
    <>
      <div>
        <p className="text-sm text-muted">
          {inv2.inviter ? `${inv2.inviter} запрошує тебе` : "Тебе запрошують"} до команди
        </p>
        <p className="font-display text-xl font-bold">«{inv2.teamName}»</p>
      </div>
      <ExternalOpen storageKey="wq_pending_invite" token={token} />
      <JoinPanel token={token} loggedIn={!!me} teamName={inv2.teamName} />
    </>,
  );
}
