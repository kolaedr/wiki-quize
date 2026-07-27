"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StaffAdminLink } from "@/components/staff-admin-link";
import { UserButton } from "@/components/auth/user-button";

/**
 * The global header. Hidden on /admin — the admin section has its own top bar
 * and sidebar (see admin/layout.tsx), so the product header would be redundant.
 */
export function SiteHeaderInner() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="mx-auto flex w-full max-w-4xl shrink-0 items-center justify-between px-5 pb-1 pt-4">
      <Link
        href="/"
        className="font-display text-lg font-semibold tracking-tight transition-colors hover:text-accent"
      >
        WiQus
      </Link>
      <div className="flex items-center gap-2">
        <StaffAdminLink />
        <UserButton />
      </div>
    </header>
  );
}
