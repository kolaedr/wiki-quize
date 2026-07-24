import { notFound, redirect } from "next/navigation";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { Crown, Link2, Users } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { InviteButton } from "@/components/social/invite-button";
import { TeamManage } from "@/components/social/team-manage";
import { db } from "@/db";
import { sessions, teamMembers, teams } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { getUser } from "@/lib/social/session";

export const dynamic = "force-dynamic";

/** Team dashboard: members and their stats (full stats visible to the owner). */
export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await getUser();
  if (!u) redirect(`/auth?redirect=/team/${id}`);

  const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  if (!team) notFound();

  const members = await db
    .select({
      userId: teamMembers.userId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      name: user.name,
    })
    .from(teamMembers)
    .innerJoin(user, eq(user.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, id))
    .orderBy(desc(teamMembers.role), teamMembers.joinedAt);

  const isMember = members.some((m) => m.userId === u.id);
  const isOwner = team.ownerId === u.id;
  if (!isMember && !isOwner) notFound();

  // per-member stats; owner sees everyone, a plain member sees only their own
  const ids = members.map((m) => m.userId);
  const statRows = ids.length
    ? await db
        .select({
          userId: sessions.userId,
          played: sql<number>`count(*)::int`,
          total: sql<number>`coalesce(sum(${sessions.score}), 0)::int`,
        })
        .from(sessions)
        .where(and(inArray(sessions.userId, ids), isNotNull(sessions.finishedAt)))
        .groupBy(sessions.userId)
    : [];
  const statByUser = new Map(statRows.map((s) => [s.userId, s]));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 py-4">
      <Breadcrumbs items={[{ href: "/team", label: "Команди" }, { label: team.name }]} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Users size={22} /> {team.name}
        </h1>
        <TeamManage teamId={team.id} isOwner={isOwner} />
      </div>

      {/* members + stats */}
      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">
          <Users size={14} /> Учасники ({members.length})
        </h2>
        <div className="glass-card flex flex-col divide-y divide-line p-2">
          {members.map((m) => {
            const canSee = isOwner || m.userId === u.id;
            const s = statByUser.get(m.userId);
            return (
              <div key={m.userId} className="flex items-center gap-3 px-2 py-2.5 text-sm">
                <span className="flex flex-1 items-center gap-2 truncate font-medium">
                  {m.name}
                  {m.userId === u.id && <span className="text-[11px] text-muted">(ти)</span>}
                  {m.role === "owner" && <Crown size={13} className="text-accent-2" />}
                </span>
                {canSee ? (
                  <span className="text-xs text-muted">
                    зіграно: <span className="font-semibold text-fg">{s?.played ?? 0}</span> · очки:{" "}
                    <span className="font-semibold text-accent">{s?.total ?? 0}</span>
                  </span>
                ) : (
                  <Badge variant="muted">учасник</Badge>
                )}
              </div>
            );
          })}
        </div>
        {!isOwner && (
          <p className="text-[11px] text-muted">
            Статистику інших учасників бачить лише власник команди.
          </p>
        )}
      </section>

      {/* invite */}
      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">
          <Link2 size={14} /> Запросити
        </h2>
        <InviteButton teamId={team.id} teamName={team.name} />
      </section>
    </main>
  );
}
