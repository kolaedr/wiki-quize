import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ChevronRight, Crown, Users } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { TeamCreateForm } from "@/components/social/team-create-form";
import { db } from "@/db";
import { teamMembers, teams } from "@/db/schema";
import { getUser } from "@/lib/social/session";

export const dynamic = "force-dynamic";

/** My teams: the ones I own or belong to, plus a create form. */
export default async function TeamsPage() {
  const u = await getUser();
  if (!u) redirect("/auth?redirect=/team");

  const myMemberships = await db
    .select({ teamId: teamMembers.teamId, role: teamMembers.role })
    .from(teamMembers)
    .where(eq(teamMembers.userId, u.id));
  const teamIds = myMemberships.map((m) => m.teamId);
  const roleByTeam = new Map(myMemberships.map((m) => [m.teamId, m.role]));

  const rows = teamIds.length
    ? await db
        .select({
          id: teams.id,
          name: teams.name,
          createdAt: teams.createdAt,
          members: sql<number>`count(${teamMembers.id})::int`,
        })
        .from(teams)
        .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
        .where(inArray(teams.id, teamIds))
        .groupBy(teams.id)
        .orderBy(desc(teams.createdAt))
    : [];

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
      <Breadcrumbs items={[{ label: "Команди" }]} />
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Users size={22} /> Мої команди
      </h1>

      {rows.length === 0 && (
        <p className="text-sm text-muted">
          Ще немає команд. Створи команду — і клич рідних чи друзів грати разом.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((tm) => (
          <Link
            key={tm.id}
            href={`/team/${tm.id}`}
            className="glass-card flex items-center gap-3 p-4 transition-colors hover:border-accent/60"
          >
            <div className="flex-1">
              <p className="flex items-center gap-2 font-semibold">
                {tm.name}
                {roleByTeam.get(tm.id) === "owner" && (
                  <Crown size={13} className="text-accent-2" />
                )}
              </p>
              <p className="text-xs text-muted">
                учасників: {tm.members} · {roleByTeam.get(tm.id) === "owner" ? "власник" : "учасник"}
              </p>
            </div>
            <Badge variant="muted">відкрити</Badge>
            <ChevronRight size={16} className="text-muted" />
          </Link>
        ))}
      </div>

      <TeamCreateForm />
    </main>
  );
}
