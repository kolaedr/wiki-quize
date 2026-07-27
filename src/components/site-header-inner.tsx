"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Shield } from "lucide-react";
import type { StaffLevel } from "@/lib/admin/guard";
import { UserButton } from "@/components/auth/user-button";

/**
 * The global header. Hidden on /admin — the admin section has its own top bar
 * and sidebar (see admin/layout.tsx), so the product header would be redundant.
 */
export function SiteHeaderInner({ staffLevel }: { staffLevel: StaffLevel | null }) {
  const pathname = usePathname();
  const t = useTranslations("footer");
  if (pathname.startsWith("/admin")) return null;

  const adminHref = staffLevel === "super" ? "/admin" : "/admin/games";

  return (
    <header className="mx-auto flex w-full max-w-4xl shrink-0 items-center justify-between px-5 pb-1 pt-4">
      <Link
        href="/"
        className="font-display text-lg font-semibold tracking-tight transition-colors hover:text-accent"
      >
        WiQus
      </Link>
      <div className="flex items-center gap-2">
        {staffLevel && (
          <Link
            href={adminHref}
            title={t("admin")}
            className="glass-card flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-accent"
          >
            <Shield size={17} />
          </Link>
        )}
        <UserButton />
      </div>
    </header>
  );
}
