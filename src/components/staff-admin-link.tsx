"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Shield } from "lucide-react";
import { useEffect, useState } from "react";
import type { StaffLevel } from "@/lib/admin/guard";
import { getMyStaffLevel } from "@/lib/admin/staff-action";
import { useSession } from "@/lib/auth-client";

function StaffAdminLinkInner({ userId }: { userId: string }) {
  const t = useTranslations("footer");
  const [level, setLevel] = useState<StaffLevel | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyStaffLevel().then((next) => {
      if (!cancelled) setLevel(next);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
