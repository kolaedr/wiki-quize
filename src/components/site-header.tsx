import { SiteHeaderInner } from "@/components/site-header-inner";
import { getStaff } from "@/lib/admin/guard";

/** Global header — visible on every page except /admin (own bar there). */
export async function SiteHeader() {
  const staff = await getStaff().catch(() => null);
  return <SiteHeaderInner staffLevel={staff?.level ?? null} />;
}
