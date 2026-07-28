"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getMyStaffLevel } from "@/lib/admin/staff-action";
import { useSession } from "@/lib/auth-client";

function StaffAdminLinkInner({ userId }: { userId: string }) {
  const t = useTranslations("footer");
  // keyed by user so switching accounts can't show the previous one's level;
  // cached, so the check doesn't re-run on every navigation
  const { data: level } = useQuery({
    queryKey: ["staff", "level", userId],
    queryFn: () => getMyStaffLevel(),
  });

  if (!level) return null;

  const href = level === "super" ? "/admin" : "/admin/games";

  return (
    <Link
      href={href}
      title={t("admin")}
      className="glass-card flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-accent"
    >
      <Shield size={17} />
    </Link>
  );
}

/**
 * Admin shield in the product header. Re-checks staff access when the client
 * session changes (server layout alone can stay stale until router.refresh()).
 */
export function StaffAdminLink() {
  const { data: session, isPending } = useSession();
  if (isPending || !session) return null;
  return <StaffAdminLinkInner key={session.user.id} userId={session.user.id} />;
}
