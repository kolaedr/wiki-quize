import { Users } from "lucide-react";
import { listUsersAction } from "@/lib/admin/actions";
import { requireSuperPage } from "@/lib/admin/guard";
import { UserRoleRow } from "@/components/admin/user-role-row";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

/**
 * Super-admin: paginated user list. Grant the game-moderator role to trusted
 * people so they can tidy game titles/icons and toggle games — without any of
 * the generation controls.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireSuperPage();
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const res = await listUsersAction(page);

  const makeHref = (p: number) => (p > 1 ? `/admin/users?page=${p}` : "/admin/users");

  return (
    <>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Users size={20} /> Користувачі
      </h1>
      <p className="text-sm text-muted">
        Модератор ігор може вмикати/вимикати ігри, міняти назву та іконку. Генерація
        й датасети лишаються тільки в супер-адміна.
      </p>

      {!res.ok && <p className="text-sm text-danger">{res.message}</p>}

      {res.ok && res.users.length === 0 && (
        <p className="text-sm text-muted">Поки що немає користувачів.</p>
      )}

      {res.ok && (
        <section className="flex flex-col gap-2">
          {res.users.map((u) => (
            <UserRoleRow key={u.id} {...u} />
          ))}
        </section>
      )}

      {res.ok && <Pagination page={page} hasNext={res.hasNext} makeHref={makeHref} />}
    </>
  );
}
