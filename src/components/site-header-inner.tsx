"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserButton } from "@/components/auth/user-button";

/**
 * The global header. Hidden on /admin — the admin section has its own top bar
 * and sidebar (see admin/layout.tsx), so the product header would be redundant.
 */
export function SiteHeaderInner({ admin }: { admin: boolean }) {
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
        {admin && (
          <Link
            href="/admin"
            title="Admin"
            className="glass-card flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-accent"
          >
            <Shield size={17} />
          </Link>
        )}
        <UserButton />
        <ThemeToggle />
      </div>
    </header>
  );
}
