import { SiteHeaderInner } from "@/components/site-header-inner";

/** Global header — visible on every page except /admin (own bar there). */
export function SiteHeader() {
  return <SiteHeaderInner />;
}
