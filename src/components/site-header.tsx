import { SiteHeaderInner } from "@/components/site-header-inner";
import { getAdminSession } from "@/lib/admin/guard";

/** Global header — visible on every page except /admin (own bar there). */
export async function SiteHeader() {
  const admin = await getAdminSession().catch(() => null);
  return <SiteHeaderInner admin={!!admin} />;
}
