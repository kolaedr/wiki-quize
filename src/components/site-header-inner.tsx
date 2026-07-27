"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StaffAdminLink } from "@/components/staff-admin-link";
import { UserButton } from "@/components/auth/user-button";
import { useGame } from "@/stores/game";

/**
 * The global header. Hidden on /admin — the admin section has its own top bar
 * and sidebar (see admin/layout.tsx), so the product header would be redundant.
 *
 * While a game is running it also carries the game's name as a subline under
 * the logo: the play screen is height-constrained, so a separate title row
 * there would cost space the board needs.
 */
export function SiteHeaderInner() {
  const pathname = usePathname();
  const gameTitle = useGame((s) => s.title);
  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="mx-auto flex w-full max-w-4xl shrink-0 items-center justify-between px-5 pb-1 pt-4">
      <Link href="/" className="flex min-w-0 flex-col leading-none transition-colors hover:text-accent">
        <span className="font-display text-lg font-semibold tracking-tight">WiQus</span>
        {gameTitle && (
          <span className="truncate text-[11px] font-medium text-muted">{gameTitle}</span>
        )}
      </Link>
      <div className="flex items-center gap-2">
        <StaffAdminLink />
        <UserButton />
      </div>
    </header>
  );
}
